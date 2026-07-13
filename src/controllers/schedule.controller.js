const { ReportSchedule, Department, Team, User, Report } = require('../models');
const { Op } = require('sequelize');
const { getCurrentPeriod } = require('../utils/schedulePeriod');

// ─── GET /api/schedules ───────────────────────────────────────
// Employees see only their department/team's schedules (+ company-wide ones),
// enriched with current-period status so the app can show Open / Submitted / Overdue.
// Reviewers/Approvers/Admins see everything, unchanged.
const getAllSchedules = async (req, res, next) => {
    try {
        const where = {};

        if (req.user.role === 'employee') {
            const requester = await User.findByPk(req.user.id);

            where[Op.and] = [
                {
                    [Op.or]: [
                        { dept_id: null },
                        { dept_id: requester.dept_id },
                    ],
                },
                {
                    [Op.or]: [
                        { team_id: null },
                        { team_id: requester.team_id },
                    ],
                },
            ];
        }

        const schedules = await ReportSchedule.findAll({
            where,
            include: [
                { association: 'creator', attributes: ['user_id', 'full_name'] },
                { association: 'department', attributes: ['dept_id', 'name'] },
                { association: 'team', attributes: ['team_id', 'name'] },
            ],
            order: [['created_at', 'DESC']],
        });

        let result = schedules;

        if (req.user.role === 'employee') {
            const now = new Date();
            result = await Promise.all(
                schedules.map(async (s) => {
                    const plain = s.toJSON();
                    const period = getCurrentPeriod(plain, now);

                    const existing = await Report.findOne({
                        where: {
                            schedule_id: plain.schedule_id,
                            employee_id: req.user.id,
                            submitted_at: { [Op.between]: [period.periodStart, period.periodEnd] },
                        },
                        attributes: ['report_id', 'status', 'submitted_at'],
                    });

                    return {
                        ...plain,
                        currentPeriod: {
                            start: period.periodStart,
                            end: period.periodEnd,
                            deadline: period.periodDeadline,
                            isRecurring: period.isRecurring,
                        },
                        alreadySubmitted: !!existing,
                        existingReportId: existing?.report_id ?? null,
                        existingReportStatus: existing?.status ?? null,
                        isOverdue: !existing && now > period.periodDeadline,
                    };
                })
            );
        }

        res.json({ success: true, count: result.length, schedules: result });
    } catch (err) {
        next(err);
    }
};

// ─── GET /api/schedules/:id ───────────────────────────────────
const getScheduleById = async (req, res, next) => {
    try {
        const schedule = await ReportSchedule.findByPk(req.params.id, {
            include: [
                { association: 'creator', attributes: ['user_id', 'full_name'] },
                { association: 'department', attributes: ['dept_id', 'name'] },
                { association: 'team', attributes: ['team_id', 'name'] },
            ],
        });

        if (!schedule) {
            return res.status(404).json({ success: false, error: 'Schedule not found' });
        }

        // Employees can't fetch a schedule outside their dept/team by guessing an ID
        if (req.user.role === 'employee') {
            const requester = await User.findByPk(req.user.id);
            const belongsToDept = !schedule.dept_id || schedule.dept_id === requester.dept_id;
            const belongsToTeam = !schedule.team_id || schedule.team_id === requester.team_id;
            if (!belongsToDept || !belongsToTeam) {
                return res.status(403).json({ success: false, error: 'Access denied' });
            }
        }

        res.json({ success: true, schedule });
    } catch (err) {
        next(err);
    }
};

// ─── POST /api/schedules ──────────────────────────────────────
const createSchedule = async (req, res, next) => {
    try {
        const { title, report_type, frequency, start_date, deadline, dept_id, team_id } = req.body;

        const schedule = await ReportSchedule.create({
            title,
            report_type,
            frequency,
            start_date,
            deadline,
            dept_id: dept_id || null,
            team_id: team_id || null,
            created_by: req.user.id,
        });

        res.status(201).json({ success: true, schedule });
    } catch (err) {
        next(err);
    }
};

// ─── PUT /api/schedules/:id ───────────────────────────────────
const updateSchedule = async (req, res, next) => {
    try {
        const schedule = await ReportSchedule.findByPk(req.params.id);
        if (!schedule) {
            return res.status(404).json({ success: false, error: 'Schedule not found' });
        }

        const { title, report_type, frequency, start_date, deadline, dept_id, team_id } = req.body;
        const updates = {};
        if (title) updates.title = title;
        if (report_type) updates.report_type = report_type;
        if (frequency) updates.frequency = frequency;
        if (start_date) updates.start_date = start_date;
        if (deadline) updates.deadline = deadline;
        if (dept_id !== undefined) updates.dept_id = dept_id;
        if (team_id !== undefined) updates.team_id = team_id;

        await schedule.update(updates);

        res.json({ success: true, schedule });
    } catch (err) {
        next(err);
    }
};

// ─── DELETE /api/schedules/:id ────────────────────────────────
const deleteSchedule = async (req, res, next) => {
    try {
        const schedule = await ReportSchedule.findByPk(req.params.id);
        if (!schedule) {
            return res.status(404).json({ success: false, error: 'Schedule not found' });
        }

        await schedule.destroy();

        res.json({ success: true, message: 'Schedule deleted' });
    } catch (err) {
        next(err);
    }
};

module.exports = { getAllSchedules, getScheduleById, createSchedule, updateSchedule, deleteSchedule };