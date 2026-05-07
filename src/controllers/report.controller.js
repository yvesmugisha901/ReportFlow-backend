const { Report, ReportSchedule, User, ReviewLog, Notification } = require('../models');
const { Op } = require('sequelize');

// ─── GET /api/reports ─────────────────────────────────────────
// Admin/reviewer/approver: all | Employee: own only
const getAllReports = async (req, res, next) => {
    try {
        const where = {};

        if (req.user.role === 'employee') {
            where.employee_id = req.user.id;
        }

        // Optional filters: ?status=submitted&employee_id=3
        if (req.query.status) where.status = req.query.status;
        if (req.query.employee_id && req.user.role !== 'employee') {
            where.employee_id = req.query.employee_id;
        }

        const reports = await Report.findAll({
            where,
            include: [
                { association: 'employee', attributes: ['user_id', 'full_name', 'email'] },
                { association: 'schedule', attributes: ['schedule_id', 'title', 'deadline', 'frequency'] },
            ],
            order: [['created_at', 'DESC']],
        });

        res.json({ success: true, count: reports.length, reports });
    } catch (err) {
        next(err);
    }
};

// ─── GET /api/reports/:id ─────────────────────────────────────
const getReportById = async (req, res, next) => {
    try {
        const report = await Report.findByPk(req.params.id, {
            include: [
                { association: 'employee', attributes: ['user_id', 'full_name', 'email'] },
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

        // Employee can only see their own
        if (req.user.role === 'employee' && report.employee_id !== req.user.id) {
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
        const { schedule_id, title, content } = req.body;

        const schedule = await ReportSchedule.findByPk(schedule_id);
        if (!schedule) {
            return res.status(404).json({ success: false, error: 'Schedule not found' });
        }

        // file_path set by multer middleware if file uploaded
        const file_path = req.file ? req.file.path : null;
        const file_name = req.file ? req.file.originalname : null;

        if (!content && !file_path) {
            return res.status(400).json({ success: false, error: 'Report must have content or an uploaded file' });
        }

        const report = await Report.create({
            schedule_id,
            employee_id: req.user.id,
            title,
            content: content || null,
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
        const report = await Report.findByPk(req.params.id);
        if (!report) {
            return res.status(404).json({ success: false, error: 'Report not found' });
        }

        if (report.employee_id !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        if (!['pending', 'changes_requested'].includes(report.status)) {
            return res.status(400).json({ success: false, error: `Cannot submit a report with status '${report.status}'` });
        }

        // Check if late
        const schedule = await ReportSchedule.findByPk(report.schedule_id);
        const now = new Date();
        const deadline = new Date(schedule.deadline);
        const is_late = now > deadline;

        await report.update({
            status: 'submitted',
            submitted_at: now,
            is_late,
        });

        res.json({ success: true, report });
    } catch (err) {
        next(err);
    }
};

// ─── PUT /api/reports/:id ─────────────────────────────────────
// Employee edits their own pending/changes_requested report
const updateReport = async (req, res, next) => {
    try {
        const report = await Report.findByPk(req.params.id);
        if (!report) {
            return res.status(404).json({ success: false, error: 'Report not found' });
        }

        if (report.employee_id !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        if (!['pending', 'changes_requested'].includes(report.status)) {
            return res.status(400).json({ success: false, error: 'Only pending or changes-requested reports can be edited' });
        }

        const { title, content } = req.body;
        const file_path = req.file ? req.file.path : report.file_path;
        const file_name = req.file ? req.file.originalname : report.file_name;

        await report.update({ title, content, file_path, file_name });

        res.json({ success: true, report });
    } catch (err) {
        next(err);
    }
};


const deleteReport=async(req,res,next)=>{try{const report=await Report.findByPk(req.params.id);if(!report)return res.status(404).json({success:false,error:'Report not found'});if(report.employee_id!==req.user.id)return res.status(403).json({success:false,error:'Access denied'});if(report.status!=='pending')return res.status(400).json({success:false,error:'Only pending reports can be deleted'});await report.destroy();res.json({success:true,message:'Report deleted'});}catch(err){next(err);}};
module.exports = { getAllReports, getReportById, createReport, updateReport, deleteReport, submitReport };