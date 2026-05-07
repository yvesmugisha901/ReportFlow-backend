const { Report, User, Department, Team, ReportSchedule, Notification } = require('../models');
const { Op, fn, col, literal } = require('sequelize');

/**
 * Admin Dashboard — FR-12
 * Total reports, pending approvals, compliance rates, breakdown by dept/status
 */
const getAdminDashboard = async () => {
    const [
        totalReports,
        pendingReview,
        approved,
        rejected,
        lateReports,
        totalUsers,
        reportsByStatus,
        reportsByDept,
    ] = await Promise.all([
        Report.count(),
        Report.count({ where: { status: { [Op.in]: ['submitted', 'under_review'] } } }),
        Report.count({ where: { status: 'approved' } }),
        Report.count({ where: { status: 'rejected' } }),
        Report.count({ where: { is_late: true } }),
        User.count({ where: { is_active: true } }),

        // Group by status
        Report.findAll({
            attributes: ['status', [fn('COUNT', col('id')), 'count']],
            group: ['status'],
            raw: true,
        }),

        // Group by department
        Report.findAll({
            attributes: ['department_id', [fn('COUNT', col('Report.id')), 'count']],
            include: [{ model: Department, as: 'department', attributes: ['name'] }],
            group: ['department_id', 'department.id'],
            raw: true,
        }),
    ]);

    const complianceRate = totalReports > 0
        ? Math.round((approved / totalReports) * 100)
        : 0;

    return {
        summary: {
            total_reports: totalReports,
            pending_review: pendingReview,
            approved,
            rejected,
            late_reports: lateReports,
            total_active_users: totalUsers,
            compliance_rate: `${complianceRate}%`,
        },
        reports_by_status: reportsByStatus,
        reports_by_department: reportsByDept,
    };
};

/**
 * Department Dashboard — FR-13
 * Submission progress for the current period, pending/completed reports
 */
const getDepartmentDashboard = async (departmentId) => {
    const [pending, submitted, approved, changesRequested, total] = await Promise.all([
        Report.count({ where: { department_id: departmentId, status: 'pending' } }),
        Report.count({ where: { department_id: departmentId, status: 'submitted' } }),
        Report.count({ where: { department_id: departmentId, status: 'approved' } }),
        Report.count({ where: { department_id: departmentId, status: 'changes_requested' } }),
        Report.count({ where: { department_id: departmentId } }),
    ]);

    const recentReports = await Report.findAll({
        where: { department_id: departmentId },
        include: [{ model: User, as: 'employee', attributes: ['id', 'name'] }],
        order: [['created_at', 'DESC']],
        limit: 10,
    });

    return {
        summary: { total, pending, submitted, approved, changes_requested: changesRequested },
        recent_reports: recentReports,
    };
};

/**
 * Reviewer Dashboard — FR-14
 * List of reports awaiting Stage 1 review for their department
 */
const getReviewerDashboard = async (reviewerUser) => {
    const awaitingReview = await Report.findAll({
        where: {
            department_id: reviewerUser.department_id,
            status: 'submitted',
        },
        include: [
            { model: User, as: 'employee', attributes: ['id', 'name', 'email'] },
            { model: ReportSchedule, as: 'schedule', attributes: ['id', 'title', 'deadline'] },
        ],
        order: [['submitted_at', 'ASC']], // oldest first — fairness
    });

    const recentlyReviewed = await Report.findAll({
        where: {
            department_id: reviewerUser.department_id,
            status: { [Op.in]: ['under_review', 'approved', 'rejected', 'changes_requested'] },
        },
        order: [['updated_at', 'DESC']],
        limit: 5,
    });

    return {
        awaiting_review: awaitingReview,
        awaiting_count: awaitingReview.length,
        recently_reviewed: recentlyReviewed,
    };
};

/**
 * Employee Dashboard
 * Own reports summary + upcoming deadlines
 */
const getEmployeeDashboard = async (employee) => {
    const [myReports, upcomingSchedules] = await Promise.all([
        Report.findAll({
            where: { employee_id: employee.id },
            order: [['created_at', 'DESC']],
            limit: 10,
        }),
        ReportSchedule.findAll({
            where: {
                deadline: { [Op.gte]: new Date() },
                [Op.or]: [
                    { department_id: employee.department_id },
                    { team_id: employee.team_id },
                ],
            },
            order: [['deadline', 'ASC']],
            limit: 5,
        }),
    ]);

    const statusCounts = myReports.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
    }, {});

    return {
        status_summary: statusCounts,
        recent_reports: myReports,
        upcoming_deadlines: upcomingSchedules,
    };
};

module.exports = {
    getAdminDashboard,
    getDepartmentDashboard,
    getReviewerDashboard,
    getEmployeeDashboard,
};