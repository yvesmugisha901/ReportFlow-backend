const { Report, ReportSchedule, User, Department, Team, ReviewLog } = require('../models');
const { Op } = require('sequelize');
const notificationService = require('./notification.service');

const reportIncludes = [
    { model: User, as: 'employee', attributes: ['id', 'name', 'email'] },
    { model: ReportSchedule, as: 'schedule', attributes: ['id', 'title', 'deadline', 'frequency'] },
    { model: Department, as: 'department', attributes: ['id', 'name'] },
    { model: ReviewLog, as: 'reviewLogs', include: [{ model: User, as: 'reviewer', attributes: ['id', 'name', 'role'] }] },
];

/**
 * Get reports — filtered by role:
 *  - employee: only their own
 *  - reviewer: all reports in their department
 *  - approver/admin: all reports
 */
const getAllReports = async (requestingUser, filters = {}) => {
    const where = {};

    // Role-based scoping
    if (requestingUser.role === 'employee') {
        where.employee_id = requestingUser.id;
    } else if (requestingUser.role === 'reviewer') {
        where.department_id = requestingUser.department_id;
    }
    // admin and approver see everything — no extra filter

    // Additional optional filters
    if (filters.status) where.status = filters.status;
    if (filters.department_id && requestingUser.role !== 'employee') {
        where.department_id = filters.department_id;
    }
    if (filters.schedule_id) where.schedule_id = filters.schedule_id;
    if (filters.is_late !== undefined) where.is_late = filters.is_late;
    if (filters.dateFrom || filters.dateTo) {
        where.created_at = {};
        if (filters.dateFrom) where.created_at[Op.gte] = new Date(filters.dateFrom);
        if (filters.dateTo) where.created_at[Op.lte] = new Date(filters.dateTo);
    }

    return Report.findAll({
        where,
        include: reportIncludes,
        order: [['created_at', 'DESC']],
    });
};

/**
 * Get a single report by ID — enforces visibility rules
 */
const getReportById = async (id, requestingUser) => {
    const report = await Report.findByPk(id, { include: reportIncludes });

    if (!report) {
        const error = new Error('Report not found');
        error.statusCode = 404;
        throw error;
    }

    // Access control
    if (
        requestingUser.role === 'employee' &&
        report.employee_id !== requestingUser.id
    ) {
        const error = new Error('Access denied');
        error.statusCode = 403;
        throw error;
    }

    if (
        requestingUser.role === 'reviewer' &&
        report.department_id !== requestingUser.department_id
    ) {
        const error = new Error('Access denied');
        error.statusCode = 403;
        throw error;
    }

    return report;
};

/**
 * Create a report (employee saves a draft)
 */
const createReport = async (employeeId, data) => {
    const employee = await User.findByPk(employeeId);

    const report = await Report.create({
        ...data,
        employee_id: employeeId,
        department_id: employee.department_id,
        status: 'pending',
        is_late: false,
    });

    return Report.findByPk(report.id, { include: reportIncludes });
};

/**
 * Update a report — only allowed if status is pending or changes_requested
 */
const updateReport = async (id, employeeId, data) => {
    const report = await Report.findByPk(id);

    if (!report) {
        const error = new Error('Report not found');
        error.statusCode = 404;
        throw error;
    }

    if (report.employee_id !== employeeId) {
        const error = new Error('You can only edit your own reports');
        error.statusCode = 403;
        throw error;
    }

    const editableStatuses = ['pending', 'changes_requested'];
    if (!editableStatuses.includes(report.status)) {
        const error = new Error(`Report cannot be edited in '${report.status}' status`);
        error.statusCode = 400;
        throw error;
    }

    await report.update(data);
    return Report.findByPk(id, { include: reportIncludes });
};

/**
 * Submit a report for review — marks it as submitted and checks if late
 */
const submitReport = async (id, employeeId) => {
    const report = await Report.findByPk(id, {
        include: [{ model: ReportSchedule, as: 'schedule' }],
    });

    if (!report) {
        const error = new Error('Report not found');
        error.statusCode = 404;
        throw error;
    }

    if (report.employee_id !== employeeId) {
        const error = new Error('You can only submit your own reports');
        error.statusCode = 403;
        throw error;
    }

    const editableStatuses = ['pending', 'changes_requested'];
    if (!editableStatuses.includes(report.status)) {
        const error = new Error('This report has already been submitted');
        error.statusCode = 400;
        throw error;
    }

    // Check if late
    const isLate = report.schedule && new Date() > new Date(report.schedule.deadline);

    await report.update({
        status: 'submitted',
        submitted_at: new Date(),
        is_late: isLate,
    });

    // Notify the department reviewer
    const reviewer = await User.findOne({
        where: { role: 'reviewer', department_id: report.department_id },
    });

    if (reviewer) {
        await notificationService.createNotification({
            user_id: reviewer.id,
            report_id: report.id,
            type: 'report_submitted',
            message: `A new report "${report.title}" has been submitted and is awaiting your review.`,
        });
    }

    // Also notify admin
    const admins = await User.findAll({ where: { role: 'admin', is_active: true } });
    for (const admin of admins) {
        await notificationService.createNotification({
            user_id: admin.id,
            report_id: report.id,
            type: 'report_submitted',
            message: `Report "${report.title}" submitted${isLate ? ' (LATE)' : ''}.`,
        });
    }

    return Report.findByPk(id, { include: reportIncludes });
};

/**
 * Delete a report — only if still pending
 */
const deleteReport = async (id, employeeId) => {
    const report = await Report.findByPk(id);

    if (!report) {
        const error = new Error('Report not found');
        error.statusCode = 404;
        throw error;
    }

    if (report.employee_id !== employeeId) {
        const error = new Error('You can only delete your own reports');
        error.statusCode = 403;
        throw error;
    }

    if (report.status !== 'pending') {
        const error = new Error('Only pending reports can be deleted');
        error.statusCode = 400;
        throw error;
    }

    await report.destroy();
    return { message: 'Report deleted successfully' };
};

module.exports = {
    getAllReports,
    getReportById,
    createReport,
    updateReport,
    submitReport,
    deleteReport,
};