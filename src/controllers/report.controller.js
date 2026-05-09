const { Report, ReportSchedule, User, Department, ReviewLog, Notification } = require('../models');
const { Op } = require('sequelize');

// ─── GET /api/reports ─────────────────────────────────────────
const getAllReports = async (req, res, next) => {
    try {
        const where = {};
        const userId = req.user.id; // ← fixed: PK is user_id not id

        if (req.user.role === 'employee') {
            where.employee_id = userId;
        }

        if (req.query.status) where.status = req.query.status;
        if (req.query.employee_id && req.user.role !== 'employee') {
            where.employee_id = req.query.employee_id;
        }

        // Search by title
        if (req.query.search) {
            where.title = { [Op.iLike]: `%${req.query.search}%` };
        }

        // Pagination
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const offset = (page - 1) * limit;

        const { count, rows: reports } = await Report.findAndCountAll({
            where,
            include: [
                {
                    association: 'employee',
                    attributes: ['user_id', 'full_name', 'email'],
                    include: [
                        { association: 'department', attributes: ['dept_id', 'name'] },
                    ],
                },
                { association: 'schedule', attributes: ['schedule_id', 'title', 'deadline', 'frequency'] },
                {
                    association: 'reviewLogs',
                    include: [{ association: 'reviewer', attributes: ['user_id', 'full_name', 'role'] }],
                    separate: true,
                    order: [['created_at', 'ASC']],
                },
            ],
            order: [['created_at', 'DESC']],
            limit,
            offset,
        });

        res.json({
            success: true,
            count,
            totalPages: Math.ceil(count / limit),
            page,
            reports,
        });
    } catch (err) {
        next(err);
    }
};

// ─── GET /api/reports/:id ─────────────────────────────────────
const getReportById = async (req, res, next) => {
    try {
        const userId = req.user.id;

        const report = await Report.findByPk(req.params.id, {
            include: [
                {
                    association: 'employee',
                    attributes: ['user_id', 'full_name', 'email'],
                    include: [{ association: 'department', attributes: ['dept_id', 'name'] }],
                },
                { association: 'schedule', attributes: ['schedule_id', 'title', 'deadline', 'frequency'] },
                {
                    association: 'reviewLogs',
                    include: [{ association: 'reviewer', attributes: ['user_id', 'full_name', 'role'] }],
                    order: [['created_at', 'ASC']],
                },
            ],
        });

        if (!report) {
            return res.status(404).json({ success: false, error: 'Report not found' });
        }

        if (req.user.role === 'employee' && report.employee_id !== userId) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        res.json({ success: true, report });
    } catch (err) {
        next(err);
    }
};

// ─── POST /api/reports ────────────────────────────────────────
// schedule_id is now optional — employee can submit without a schedule
const createReport = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { schedule_id, title, content, summary, notes, period_start, period_end } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ success: false, error: 'Title is required' });
        }

        // Validate schedule if provided
        if (schedule_id) {
            const schedule = await ReportSchedule.findByPk(schedule_id);
            if (!schedule) {
                return res.status(404).json({ success: false, error: 'Schedule not found' });
            }
        }

        const file_path = req.file ? req.file.path : null;
        const file_name = req.file ? req.file.originalname : null;

        if (!content && !summary && !file_path) {
            return res.status(400).json({ success: false, error: 'Report must have content or an uploaded file' });
        }

        const report = await Report.create({
            schedule_id: schedule_id || null,
            employee_id: userId,
            title: title.trim(),
            content: content || summary || null,  // summary falls back to content field
            file_path: file_path || null,
            file_name: file_name || null,
            status: 'pending',
        });

        res.status(201).json({ success: true, report });
    } catch (err) {
        next(err);
    }
};

// ─── PATCH /api/reports/:id/submit ───────────────────────────
const submitReport = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const report = await Report.findByPk(req.params.id);

        if (!report) {
            return res.status(404).json({ success: false, error: 'Report not found' });
        }

        if (report.employee_id !== userId) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        if (!['pending', 'changes_requested'].includes(report.status)) {
            return res.status(400).json({
                success: false,
                error: `Cannot submit a report with status '${report.status}'`,
            });
        }

        const now = new Date();
        let is_late = false;

        if (report.schedule_id) {
            const schedule = await ReportSchedule.findByPk(report.schedule_id);
            if (schedule?.deadline) {
                is_late = now > new Date(schedule.deadline);
            }
        }

        await report.update({ status: 'submitted', submitted_at: now, is_late });

        res.json({ success: true, report });
    } catch (err) {
        next(err);
    }
};

// ─── PUT /api/reports/:id ─────────────────────────────────────
const updateReport = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const report = await Report.findByPk(req.params.id);

        if (!report) {
            return res.status(404).json({ success: false, error: 'Report not found' });
        }

        if (report.employee_id !== userId) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        if (!['pending', 'changes_requested'].includes(report.status)) {
            return res.status(400).json({
                success: false,
                error: 'Only pending or changes-requested reports can be edited',
            });
        }

        const { title, content, summary } = req.body;
        const file_path = req.file ? req.file.path : report.file_path;
        const file_name = req.file ? req.file.originalname : report.file_name;

        await report.update({
            title: title ?? report.title,
            content: content ?? summary ?? report.content,
            file_path,
            file_name,
        });

        res.json({ success: true, report });
    } catch (err) {
        next(err);
    }
};

// ─── DELETE /api/reports/:id ──────────────────────────────────
const deleteReport = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const report = await Report.findByPk(req.params.id);

        if (!report) return res.status(404).json({ success: false, error: 'Report not found' });
        if (report.employee_id !== userId) return res.status(403).json({ success: false, error: 'Access denied' });
        if (report.status !== 'pending') return res.status(400).json({ success: false, error: 'Only pending reports can be deleted' });

        await report.destroy();
        res.json({ success: true, message: 'Report deleted' });
    } catch (err) {
        next(err);
    }
};

module.exports = { getAllReports, getReportById, createReport, updateReport, deleteReport, submitReport };