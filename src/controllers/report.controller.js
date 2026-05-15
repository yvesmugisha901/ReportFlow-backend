const { Report, ReportSchedule, User, Department, ReviewLog, Notification } = require('../models');
const { Op } = require('sequelize');

// ─── Notification helper ──────────────────────────────────────
async function notify({ user_id, report_id, event_type, message }) {
    try {
        await Notification.create({ user_id, report_id, event_type, message, is_read: false });
    } catch (err) {
        console.error('[notify] Failed to create notification:', err.message);
    }
}

// ─── GET /api/reports ─────────────────────────────────────────
const getAllReports = async (req, res, next) => {
    try {
        const where = {};
        const userId = req.user.id; // ← fixed

        if (req.user.role === 'employee') {
            where.employee_id = userId;
        }

        if (req.query.status) {
            where.status = req.query.status;
        }

        if (req.query.employee_id && req.user.role !== 'employee') {
            where.employee_id = req.query.employee_id;
        }

        if (req.query.search) {
            where.title = { [Op.iLike]: `%${req.query.search}%` };
        }

        if (req.query.date_from || req.query.date_to) {
            where.submitted_at = {};
            if (req.query.date_from) {
                where.submitted_at[Op.gte] = new Date(req.query.date_from);
            }
            if (req.query.date_to) {
                const end = new Date(req.query.date_to);
                end.setHours(23, 59, 59, 999);
                where.submitted_at[Op.lte] = end;
            }
        }

        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(parseInt(req.query.limit) || 15, 100);
        const offset = (page - 1) * limit;

        const deptId = req.query.dept_id && req.user.role !== 'employee'
            ? req.query.dept_id
            : null;

        const { count, rows: reports } = await Report.findAndCountAll({
            where,
            include: [
                {
                    association: 'employee',
                    attributes: ['user_id', 'full_name', 'email'],
                    required: !!deptId,
                    include: [
                        {
                            association: 'department',
                            attributes: ['dept_id', 'name'],
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
            distinct: true,
            order: [['created_at', 'DESC']],
            limit,
            offset,
        });

        res.json({ success: true, count, totalPages: Math.ceil(count / limit), page, reports });
    } catch (err) {
        next(err);
    }
};

// ─── GET /api/reports/:id ─────────────────────────────────────
const getReportById = async (req, res, next) => {
    try {
        const userId = req.user.id; // ← fixed

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
        const userId = req.user.id; // ← fixed
        const { schedule_id, title, content, summary, notes, period_start, period_end } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ success: false, error: 'Title is required' });
        }

        let schedule = null;
        if (schedule_id) {
            schedule = await ReportSchedule.findByPk(schedule_id);
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

        const now = new Date();
        const is_late = schedule?.deadline ? now > new Date(schedule.deadline) : false;

        const employee = await User.findByPk(userId, {
            include: [{ association: 'department', attributes: ['dept_id', 'name'] }],
        });

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

        // ── Notify employee: submission confirmed ─────────────
        await notify({
            user_id: userId,
            report_id: report.report_id,
            event_type: 'submitted',
            message: `Your report "${report.title}" has been submitted successfully and is awaiting review.`,
        });

        // ── Notify department reviewer ─────────────────────────
        if (employee?.dept_id) {
            const reviewer = await User.findOne({
                where: { role: 'reviewer', dept_id: employee.dept_id, is_active: true },
            });
            if (reviewer) {
                await notify({
                    user_id: reviewer.user_id, // ← correct — User PK
                    report_id: report.report_id,
                    event_type: 'submitted',
                    message: `${employee.full_name} submitted a new report "${report.title}"${is_late ? ' (submitted late)' : ''} — awaiting your review.`,
                });
            }
        }

        // ── Notify all active admins ──────────────────────────
        const admins = await User.findAll({ where: { role: 'admin', is_active: true } });
        for (const admin of admins) {
            if (admin.user_id === userId) continue;
            await notify({
                user_id: admin.user_id, // ← correct — User PK
                report_id: report.report_id,
                event_type: 'submitted',
                message: `${employee?.full_name ?? 'An employee'} submitted report "${report.title}"${is_late ? ' (late)' : ''}.`,
            });
        }

        res.status(201).json({ success: true, report });
    } catch (err) {
        next(err);
    }
};

// ─── PATCH /api/reports/:id/submit ───────────────────────────
const submitReport = async (req, res, next) => {
    try {
        const userId = req.user.id; // ← fixed

        const report = await Report.findByPk(req.params.id, {
            include: [{ association: 'schedule' }],
        });

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
        const is_late = report.schedule?.deadline
            ? now > new Date(report.schedule.deadline)
            : false;

        const wasChangesRequested = report.status === 'changes_requested';
        await report.update({ status: 'submitted', submitted_at: now, is_late });

        const employee = await User.findByPk(userId, {
            include: [{ association: 'department', attributes: ['dept_id', 'name'] }],
        });

        // ── Notify employee: resubmission confirmed ───────────
        await notify({
            user_id: userId,
            report_id: report.report_id,
            event_type: 'submitted',
            message: wasChangesRequested
                ? `Your updated report "${report.title}" has been resubmitted for review.`
                : `Your report "${report.title}" has been submitted successfully.`,
        });

        // ── Notify department reviewer ─────────────────────────
        if (employee?.dept_id) {
            const reviewer = await User.findOne({
                where: { role: 'reviewer', dept_id: employee.dept_id, is_active: true },
            });
            if (reviewer) {
                await notify({
                    user_id: reviewer.user_id,
                    report_id: report.report_id,
                    event_type: 'submitted',
                    message: wasChangesRequested
                        ? `${employee.full_name} resubmitted report "${report.title}" after changes — ready for review.`
                        : `${employee.full_name} submitted report "${report.title}"${is_late ? ' (late)' : ''} — awaiting review.`,
                });
            }
        }

        // ── Notify admins ──────────────────────────────────────
        const admins = await User.findAll({ where: { role: 'admin', is_active: true } });
        for (const admin of admins) {
            if (admin.user_id === userId) continue;
            await notify({
                user_id: admin.user_id,
                report_id: report.report_id,
                event_type: 'submitted',
                message: `${employee?.full_name ?? 'An employee'} submitted report "${report.title}"${is_late ? ' (late)' : ''}.`,
            });
        }

        res.json({ success: true, report });
    } catch (err) {
        next(err);
    }
};

// ─── PUT /api/reports/:id ─────────────────────────────────────
const updateReport = async (req, res, next) => {
    try {
        const userId = req.user.id; // ← fixed

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
        const userId = req.user.id; // ← fixed

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