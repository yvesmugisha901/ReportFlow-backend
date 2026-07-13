require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/db');
const { Department, Team, User, ReportSchedule, Report } = require('../models');

(async () => {
  try {
    const passwordHash = await bcrypt.hash('Password123!', 12);

    // ── DEPARTMENTS ──────────────────────────────
    const sales = await Department.create({ name: 'Sales', description: 'Sales department' });
    const ops = await Department.create({ name: 'Operations', description: 'Operations department' });
    const finance = await Department.create({ name: 'Finance', description: 'Finance department' });

    // ── TEAMS ────────────────────────────────────
    const salesTeamA = await Team.create({ name: 'Sales Team A', dept_id: sales.dept_id });
    const opsTeamA = await Team.create({ name: 'Ops Team A', dept_id: ops.dept_id });
    const financeTeamA = await Team.create({ name: 'Finance Team A', dept_id: finance.dept_id });

    // ── ADMIN ────────────────────────────────────
    const admin = await User.create({
      full_name: 'Admin User',
      email: 'admin@example.com',
      password_hash: passwordHash,
      role: 'admin',
    });

    // ── OVERALL APPROVER (stage 2 — not tied to a department) ──
    const approver = await User.create({
      full_name: 'Overall Approver',
      email: 'approver@example.com',
      password_hash: passwordHash,
      role: 'approver',
    });

    // ── DEPARTMENT REVIEWERS (stage 1) ──────────
    const salesReviewer = await User.create({
      full_name: 'Sales Reviewer',
      email: 'sales.reviewer@example.com',
      password_hash: passwordHash,
      role: 'reviewer',
      dept_id: sales.dept_id,
    });

    const opsReviewer = await User.create({
      full_name: 'Ops Reviewer',
      email: 'ops.reviewer@example.com',
      password_hash: passwordHash,
      role: 'reviewer',
      dept_id: ops.dept_id,
    });

    const financeReviewer = await User.create({
      full_name: 'Finance Reviewer',
      email: 'finance.reviewer@example.com',
      password_hash: passwordHash,
      role: 'reviewer',
      dept_id: finance.dept_id,
    });

    // link each department to its reviewer
    await sales.update({ reviewer_id: salesReviewer.user_id });
    await ops.update({ reviewer_id: opsReviewer.user_id });
    await finance.update({ reviewer_id: financeReviewer.user_id });

    // ── EMPLOYEES ────────────────────────────────
    const salesEmployee = await User.create({
      full_name: 'Sales Employee',
      email: 'sales.employee@example.com',
      password_hash: passwordHash,
      role: 'employee',
      dept_id: sales.dept_id,
      team_id: salesTeamA.team_id,
    });

    const opsEmployee = await User.create({
      full_name: 'Ops Employee',
      email: 'ops.employee@example.com',
      password_hash: passwordHash,
      role: 'employee',
      dept_id: ops.dept_id,
      team_id: opsTeamA.team_id,
    });

    const financeEmployee = await User.create({
      full_name: 'Finance Employee',
      email: 'finance.employee@example.com',
      password_hash: passwordHash,
      role: 'employee',
      dept_id: finance.dept_id,
      team_id: financeTeamA.team_id,
    });

    // ── REPORT SCHEDULES (one per department) ───
    const salesSchedule = await ReportSchedule.create({
      title: 'Weekly Sales Report', report_type: 'sales_summary', frequency: 'weekly',
      start_date: '2026-01-01', deadline: '2026-12-31',
      dept_id: sales.dept_id, team_id: salesTeamA.team_id, created_by: admin.user_id,
    });

    const opsSchedule = await ReportSchedule.create({
      title: 'Weekly Ops Report', report_type: 'ops_summary', frequency: 'weekly',
      start_date: '2026-01-01', deadline: '2026-12-31',
      dept_id: ops.dept_id, team_id: opsTeamA.team_id, created_by: admin.user_id,
    });

    const financeSchedule = await ReportSchedule.create({
      title: 'Monthly Finance Report', report_type: 'finance_summary', frequency: 'monthly',
      start_date: '2026-01-01', deadline: '2026-12-31',
      dept_id: finance.dept_id, team_id: financeTeamA.team_id, created_by: admin.user_id,
    });

    // ── REPORTS (different statuses, so every screen has something to show) ──
    await Report.create({
      schedule_id: salesSchedule.schedule_id, employee_id: salesEmployee.user_id,
      title: 'Week 1 Sales Summary', content: 'Sales up 12% this week across all regions.',
      status: 'pending',
    });

    await Report.create({
      schedule_id: salesSchedule.schedule_id, employee_id: salesEmployee.user_id,
      title: 'Week 2 Sales Summary', content: 'Slight dip due to holiday closures.',
      status: 'submitted', submitted_at: new Date(),
    });

    await Report.create({
      schedule_id: opsSchedule.schedule_id, employee_id: opsEmployee.user_id,
      title: 'Warehouse Inventory Check', content: 'Found minor discrepancies, recount scheduled.',
      status: 'under_review', submitted_at: new Date(),
    });

    await Report.create({
      schedule_id: financeSchedule.schedule_id, employee_id: financeEmployee.user_id,
      title: 'January Finance Report', content: 'Monthly expenses within budget, no overruns.',
      status: 'approved', submitted_at: new Date(),
    });

    console.log('✅ Full seed data created successfully');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  }
})();