const { ReportSchedule, Department, Team, User } = require('../models');

// ─── GET /api/schedules ───────────────────────────────────────
const getAllSchedules = async (req, res, next) => {
    try {
        const schedules = await ReportSchedule.findAll({
            include: [
                { association: 'creator', attributes: ['user_id', 'full_name'] },
                { association: 'department', attributes: ['dept_id', 'name'] },
                { association: 'team', attributes: ['team_id', 'name'] },
            ],
            order: [['created_at', 'DESC']],
        });

        res.json({ success: true, count: schedules.length, schedules });
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