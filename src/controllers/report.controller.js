const { Report, ReportSchedule, User, Department, ReviewLog, Notification } = require('../models');
const { Op } = require('sequelize');

// ─── GET /api/reports ─────────────────────────────────────────
const getAllReports = async (req, res, next) => {
    try {
        const where = {};
        const userId = req.user.id;

        // ── Role scoping ──────────────────────────────────────
        if (req.user.role === 'employee') {
            where.employee_id = userId;
        }

        // ── Status filter ─────────────────────────────────────
        if (req.query.status) {
            where.status = req.query.status;
        }

        // ── Employee filter (non-employee roles only) ─────────
        if (req.query.employee_id && req.user.role !== 'employee') {
            where.employee_id = req.query.employee_id;
        }

        // ── Title search ──────────────────────────────────────
        if (req.query.search) {
            where.title = { [Op.iLike]: `%${req.query.search}%` };
        }

        // ── Date range filter on submitted_at ─────────────────
        // Frontend sends: date_from=YYYY-MM-DD & date_to=YYYY-MM-DD
        if (req.query.date_from || req.query.date_to) {
            where.submitted_at = {};
            if (req.query.date_from) {
                // Start of the "from" day (00:00:00)
                where.submitted_at[Op.gte] = new Date(req.query.date_from);
            }
            if (req.query.date_to) {
                // End of the "to" day (23:59:59.999) so the selected day is fully included
                const end = new Date(req.query.date_to);
                end.setHours(23, 59, 59, 999);
                where.submitted_at[Op.lte] = end;
            }
        }

        // ── Pagination ────────────────────────────────────────
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(parseInt(req.query.limit) || 15, 100);
        const offset = (page - 1) * limit;

        // ── Department filter ─────────────────────────────────
        // Reports don't have dept_id directly; the chain is:
        //   Report → employee (User) → department (Department)
        // We apply the filter as a WHERE on the nested department include.
        const deptId = req.query.dept_id && req.user.role !== 'employee'
            ? req.query.dept_id
            : null;

        const { count, rows: reports } = await Report.findAndCountAll({
            where,
            include: [
                {
                    association: 'employee',
                    attributes: ['user_id', 'full_name', 'email'],
                    // When deptId is present, require the join so that reports
                    // whose employee has a different (or null) dept are excluded.
                    required: !!deptId,
                    include: [
                        {
                            association: 'department',
                            attributes: ['dept_id', 'name'],
                            // This is the key part: filter inside the nested include.
                            ...(deptId ? { where: { dept_id: deptId } } : {}),
                            required: !!deptId,
                        },
                    ],
                },
                {
                    association: 'schedule',
                    attributes: ['schedule_id', 'title', 'deadline', 'frequency'],
                },
                {
                    association: 'reviewLogs',
                    include: [
                        { association: 'reviewer', attributes: ['user_id', 'full_name', 'role'] },
                    ],
                    separate: true,
                    order: [['created_at', 'ASC']],
                },
            ],
            distinct: true, // required when using separate:true + findAndCountAll
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
const createReport = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { schedule_id, title, content, summary, notes, period_start, period_end } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ success: false, error: 'Title is required' });
        }

        if (schedule_id) {
            const schedule = await ReportSchedule.findByPk(schedule_id);
            if (!schedule) {
                return res.status(404).json({ success: false, error: 'Schedule not found' });
            }
        }

        const file_path = req.file ? req.file.path : null;
        const file_name = req.file ? req.file.originalname : null;

        const resolvedContent = content?.trim() || summary?.trim() || null;
        if (!resolvedContent && !file_path) {
            return res.status(400).json({
                success: false,
                error: 'Report must have content or an uploaded file',
            });
        }

        let is_late = false;
        const now = new Date();
        if (schedule_id) {
            const schedule = await ReportSchedule.findByPk(schedule_id);
            if (schedule?.deadline) {
                is_late = now > new Date(schedule.deadline);
            }
        }

        const report = await Report.create({
            schedule_id: schedule_id || null,
            employee_id: userId,
            title: title.trim(),
            content: resolvedContent,
            file_path,
            file_name,
            status: 'submitted',
            submitted_at: now,
            is_late,
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
            if (schedule?.deadline) is_late = now > new Date(schedule.deadline);
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
            content: content?.trim() ?? summary?.trim() ?? report.content,
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