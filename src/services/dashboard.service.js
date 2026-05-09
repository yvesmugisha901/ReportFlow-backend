const { Report, User, Department, Team, ReportSchedule, ReviewLog } = require('../models');
const { Op, fn, col } = require('sequelize');

/**
 * Admin Dashboard — FR-12
 */
const getAdminDashboard = async () => {
    const [
        totalReports,
        pendingReview,
        approved,
        rejected,
        lateReports,
        totalEmployees,
        totalDepartments,
        reportsByStatus,
        recentReports,
        deptBreakdown,
    ] = await Promise.all([
        Report.count(),

        Report.count({
            where: { status: { [Op.in]: ['submitted', 'under_review'] } },
        }),

        Report.count({ where: { status: 'approved' } }),

        Report.count({ where: { status: 'rejected' } }),

        Report.count({ where: { is_late: true } }),

        User.count({ where: { is_active: true, role: 'employee' } }),

        Department.count(),

        Report.findAll({
            attributes: ['status', [fn('COUNT', col('report_id')), 'count']],
            group: ['status'],
            raw: true,
        }),

        Report.findAll({
            include: [
                {
                    model: User,
                    as: 'employee',
                    attributes: ['user_id', 'full_name', 'email'],
                    include: [
                        {
                            model: Department,
                            as: 'department',
                            attributes: ['dept_id', 'name'],
                        },
                    ],
                },
                {
                    model: ReportSchedule,
                    as: 'schedule',
                    attributes: ['schedule_id', 'title', 'deadline', 'frequency'],
                },
            ],
            order: [['created_at', 'DESC']],
            limit: 10,
        }),

        Department.findAll({
            attributes: ['dept_id', 'name'],
            include: [
                {
                    model: User,
                    as: 'members',
                    attributes: ['user_id'],
                    required: false,
                    include: [
                        {
                            model: Report,
                            as: 'reports',
                            attributes: ['report_id', 'status'],
                            required: false,
                        },
                    ],
                },
            ],
        }),
    ]);

    const complianceRate = totalReports > 0
        ? Math.round((approved / totalReports) * 100)
        : 0;

    const departmentBreakdown = deptBreakdown.map((dept) => {
        const allReports = (dept.members ?? []).flatMap(m => m.reports ?? []);
        const submitted = allReports.filter(r =>
            ['submitted', 'under_review', 'approved', 'changes_requested', 'rejected'].includes(r.status)
        ).length;
        return {
            name: dept.name,
            submitted,
            total: allReports.length || submitted,
        };
    });

    return {
        totalReports,
        pendingReports: pendingReview,
        approvedReports: approved,
        rejectedReports: rejected,
        overdueReports: lateReports,
        totalEmployees,
        totalDepartments,
        complianceRate,
        reportsThisMonth: 0,
        approvedThisWeek: 0,
        newEmployeesThisMonth: 0,
        complianceRateDelta: 0,
        reports_by_status: reportsByStatus,
        recentReports,
        departmentBreakdown,
    };
};

/**
 * Approver Dashboard (COO) — FR-15
 *
 * The approver sees company-wide stats + only reports that
 * passed Stage 1 (status = 'under_review') in their queue.
 * They also see the full history of what they have approved/rejected.
 */
const getApproverDashboard = async () => {
    const [
        totalReports,
        pendingStage2,
        approved,
        rejected,
        changesRequested,
        lateReports,
        deptBreakdown,
        stage2Queue,
        recentlyActioned,
    ] = await Promise.all([

        // Total reports ever
        Report.count(),

        // Waiting for COO — passed stage 1, not yet final
        Report.count({ where: { status: 'under_review' } }),

        // Final approved
        Report.count({ where: { status: 'approved' } }),

        // Rejected at any stage
        Report.count({ where: { status: 'rejected' } }),

        // Changes requested
        Report.count({ where: { status: 'changes_requested' } }),

        // Late submissions
        Report.count({ where: { is_late: true } }),

        // Dept compliance breakdown (same as admin)
        Department.findAll({
            attributes: ['dept_id', 'name'],
            include: [
                {
                    model: User,
                    as: 'members',
                    attributes: ['user_id'],
                    required: false,
                    include: [
                        {
                            model: Report,
                            as: 'reports',
                            attributes: ['report_id', 'status'],
                            required: false,
                        },
                    ],
                },
            ],
        }),

        // Stage 2 queue — under_review reports with full detail + review logs
        Report.findAll({
            where: { status: 'under_review' },
            include: [
                {
                    model: User,
                    as: 'employee',
                    attributes: ['user_id', 'full_name', 'email'],
                    include: [
                        {
                            model: Department,
                            as: 'department',
                            attributes: ['dept_id', 'name'],
                        },
                        {
                            model: Team,
                            as: 'team',
                            attributes: ['team_id', 'name'],
                        },
                    ],
                },
                {
                    model: ReportSchedule,
                    as: 'schedule',
                    attributes: ['schedule_id', 'title', 'deadline', 'frequency'],
                },
                {
                    model: ReviewLog,
                    as: 'reviewLogs',
                    include: [
                        {
                            model: User,
                            as: 'reviewer',
                            attributes: ['user_id', 'full_name', 'role'],
                        },
                    ],
                    order: [['created_at', 'ASC']],
                },
            ],
            order: [['submitted_at', 'ASC']], // oldest first — FIFO queue
        }),

        // Recently actioned by COO (stage_2 review logs)
        ReviewLog.findAll({
            where: { stage: 'stage_2' },
            include: [
                {
                    model: Report,
                    as: 'report',
                    attributes: ['report_id', 'title', 'status'],
                    include: [
                        {
                            model: User,
                            as: 'employee',
                            attributes: ['full_name'],
                            include: [
                                {
                                    model: Department,
                                    as: 'department',
                                    attributes: ['name'],
                                },
                            ],
                        },
                    ],
                },
                {
                    model: User,
                    as: 'reviewer',
                    attributes: ['full_name'],
                },
            ],
            order: [['created_at', 'DESC']],
            limit: 10,
        }),
    ]);

    const complianceRate = totalReports > 0
        ? Math.round((approved / totalReports) * 100)
        : 0;

    const departmentBreakdownMapped = deptBreakdown.map((dept) => {
        const allReports = (dept.members ?? []).flatMap(m => m.reports ?? []);
        const submitted = allReports.filter(r =>
            ['submitted', 'under_review', 'approved', 'changes_requested', 'rejected'].includes(r.status)
        ).length;
        return {
            name: dept.name,
            submitted,
            total: allReports.length || submitted,
        };
    });

    return {
        // Summary counts — same keys the frontend reads
        totalReports,
        pendingReports: pendingStage2,   // awaiting COO sign-off
        approvedReports: approved,
        rejectedReports: rejected,
        changesRequested,
        overdueReports: lateReports,
        complianceRate,
        complianceRateDelta: 0,          // extend with historical comparison later
        reportsThisMonth: 0,
        approvedThisWeek: 0,

        // Queue + history
        stage2Queue,        // full report objects for the ReviewQueue component
        recentlyActioned,   // COO's own recent actions
        departmentBreakdown: departmentBreakdownMapped,
    };
};

/**
 * Department Dashboard — FR-13
 */
const getDepartmentDashboard = async (departmentId) => {
    const members = await User.findAll({
        where: { dept_id: departmentId },
        attributes: ['user_id'],
    });
    const employeeIds = members.map(m => m.user_id);

    const whereClause = employeeIds.length > 0
        ? { employee_id: { [Op.in]: employeeIds } }
        : { employee_id: -1 };

    const [pending, submitted, approved, changesRequested, total, recentReports] = await Promise.all([
        Report.count({ where: { ...whereClause, status: 'pending' } }),
        Report.count({ where: { ...whereClause, status: 'submitted' } }),
        Report.count({ where: { ...whereClause, status: 'approved' } }),
        Report.count({ where: { ...whereClause, status: 'changes_requested' } }),
        Report.count({ where: whereClause }),
        Report.findAll({
            where: whereClause,
            include: [{ model: User, as: 'employee', attributes: ['user_id', 'full_name'] }],
            order: [['created_at', 'DESC']],
            limit: 10,
        }),
    ]);

    return {
        summary: { total, pending, submitted, approved, changes_requested: changesRequested },
        recent_reports: recentReports,
    };
};

/**
 * Reviewer Dashboard — FR-14
 */
const getReviewerDashboard = async (reviewerUser) => {
    const members = await User.findAll({
        where: { dept_id: reviewerUser.dept_id },
        attributes: ['user_id'],
    });
    const employeeIds = members.map(m => m.user_id);

    const whereBase = employeeIds.length > 0
        ? { employee_id: { [Op.in]: employeeIds } }
        : { employee_id: -1 };

    const [awaitingReview, recentlyReviewed] = await Promise.all([
        Report.findAll({
            where: { ...whereBase, status: 'submitted' },
            include: [
                { model: User, as: 'employee', attributes: ['user_id', 'full_name', 'email'] },
                { model: ReportSchedule, as: 'schedule', attributes: ['schedule_id', 'title', 'deadline'] },
            ],
            order: [['submitted_at', 'ASC']],
        }),
        Report.findAll({
            where: {
                ...whereBase,
                status: { [Op.in]: ['under_review', 'approved', 'rejected', 'changes_requested'] },
            },
            order: [['updated_at', 'DESC']],
            limit: 5,
        }),
    ]);

    return {
        awaiting_review: awaitingReview,
        awaiting_count: awaitingReview.length,
        recently_reviewed: recentlyReviewed,
    };
};

/**
 * Employee Dashboard
 */
const getEmployeeDashboard = async (employee) => {
    const [myReports, upcomingSchedules] = await Promise.all([
        Report.findAll({
            where: { employee_id: employee.user_id },
            order: [['created_at', 'DESC']],
            limit: 10,
        }),
        ReportSchedule.findAll({
            where: {
                deadline: { [Op.gte]: new Date() },
                [Op.or]: [
                    { dept_id: employee.dept_id },
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
    getApproverDashboard,
    getDepartmentDashboard,
    getReviewerDashboard,
    getEmployeeDashboard,
};