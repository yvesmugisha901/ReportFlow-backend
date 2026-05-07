const { ReportSchedule, Department, Team, User } = require('../models');
const { Op } = require('sequelize');
const notificationService = require('./notification.service');

const scheduleIncludes = [
    { model: Department, as: 'department', attributes: ['id', 'name'] },
    { model: Team, as: 'team', attributes: ['id', 'name'] },
];

/**
 * Get all schedules — employees see only their dept/team schedules
 */
const getAllSchedules = async (requestingUser) => {
    const where = {};

    if (requestingUser.role === 'employee') {
        where[Op.or] = [
            { department_id: requestingUser.department_id },
            { team_id: requestingUser.team_id },
        ];
    }

    return ReportSchedule.findAll({
        where,
        include: scheduleIncludes,
        order: [['deadline', 'ASC']],
    });
};

/**
 * Get a single schedule by ID
 */
const getScheduleById = async (id) => {
    const schedule = await ReportSchedule.findByPk(id, { include: scheduleIncludes });
    if (!schedule) {
        const error = new Error('Schedule not found');
        error.statusCode = 404;
        throw error;
    }
    return schedule;
};

/**
 * Create a schedule (admin only)
 */
const createSchedule = async (data) => {
    const schedule = await ReportSchedule.create(data);
    return ReportSchedule.findByPk(schedule.id, { include: scheduleIncludes });
};

/**
 * Update a schedule (admin only)
 */
const updateSchedule = async (id, data) => {
    const schedule = await getScheduleById(id);
    await schedule.update(data);
    return getScheduleById(id);
};

/**
 * Delete a schedule (admin only)
 */
const deleteSchedule = async (id) => {
    const schedule = await getScheduleById(id);
    await schedule.destroy();
    return { message: 'Schedule deleted successfully' };
};

/**
 * Send deadline reminder notifications — called by a cron job
 * Notifies employees whose schedules are due in 3 days or 1 day (FR-05)
 */
const sendDeadlineReminders = async () => {
    const now = new Date();

    // Find schedules due in ~3 days or ~1 day (within a 1-hour window to avoid duplicate sends)
    const reminderWindows = [
        { days: 3, label: '3 days' },
        { days: 1, label: 'tomorrow' },
    ];

    for (const window of reminderWindows) {
        const targetDate = new Date(now.getTime() + window.days * 24 * 60 * 60 * 1000);
        const windowStart = new Date(targetDate.getTime() - 30 * 60 * 1000); // -30 min
        const windowEnd = new Date(targetDate.getTime() + 30 * 60 * 1000);   // +30 min

        const schedules = await ReportSchedule.findAll({
            where: { deadline: { [Op.between]: [windowStart, windowEnd] } },
            include: [
                { model: Department, as: 'department' },
                { model: Team, as: 'team' },
            ],
        });

        for (const schedule of schedules) {
            // Find all employees assigned to this schedule's department or team
            const where = { role: 'employee', is_active: true };
            if (schedule.department_id) where.department_id = schedule.department_id;
            if (schedule.team_id) where.team_id = schedule.team_id;

            const employees = await User.findAll({ where });

            for (const employee of employees) {
                await notificationService.createNotification({
                    user_id: employee.id,
                    report_id: null,
                    type: 'deadline_reminder',
                    message: `Reminder: Your report "${schedule.title}" is due ${window.label}. Please submit on time.`,
                });
            }
        }
    }
};

module.exports = {
    getAllSchedules,
    getScheduleById,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    sendDeadlineReminders,
};