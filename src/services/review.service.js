const { Report, ReviewLog, User, Notification } = require('../models');
const notificationService = require('./notification.service');

/**
 * Stage 1 — Department Reviewer action
 * Actions: approved_stage1 | rejected | changes_requested
 */
const reviewReport = async (reportId, reviewerId, { action, comments }) => {
    const validActions = ['approved_stage1', 'rejected', 'changes_requested'];
    if (!validActions.includes(action)) {
        const error = new Error(`Invalid action. Must be one of: ${validActions.join(', ')}`);
        error.statusCode = 400;
        throw error;
    }

    const report = await Report.findByPk(reportId, {
        include: [{ model: User, as: 'employee' }],
    });

    if (!report) {
        const error = new Error('Report not found');
        error.statusCode = 404;
        throw error;
    }

    if (report.status !== 'submitted') {
        const error = new Error(`Report must be in 'submitted' status for Stage 1 review. Current: '${report.status}'`);
        error.statusCode = 400;
        throw error;
    }

    // Map action to report status
    const statusMap = {
        approved_stage1: 'under_review',   // moves to stage 2
        rejected: 'rejected',
        changes_requested: 'changes_requested',
    };

    const newStatus = statusMap[action];

    // Update report status
    await report.update({ status: newStatus });

    // Write immutable audit log
    await ReviewLog.create({
        report_id: reportId,
        reviewer_id: reviewerId,
        stage: 1,
        action,
        comments: comments || null,
    });

    // Notify the employee
    const actionMessages = {
        approved_stage1: `Your report "${report.title}" passed Stage 1 review and has been forwarded for final approval.`,
        rejected: `Your report "${report.title}" was rejected at Stage 1. ${comments ? 'Reason: ' + comments : ''}`,
        changes_requested: `Changes were requested on your report "${report.title}". Please update and resubmit.`,
    };

    await notificationService.createNotification({
        user_id: report.employee_id,
        report_id: reportId,
        type: action,
        message: actionMessages[action],
    });

    // If approved at stage 1, notify the final approver(s)
    if (action === 'approved_stage1') {
        const approvers = await User.findAll({ where: { role: 'approver', is_active: true } });
        for (const approver of approvers) {
            await notificationService.createNotification({
                user_id: approver.id,
                report_id: reportId,
                type: 'report_submitted',
                message: `Report "${report.title}" has passed Stage 1 review and is awaiting your final approval.`,
            });
        }
    }

    return Report.findByPk(reportId, {
        include: [{ model: ReviewLog, as: 'reviewLogs' }],
    });
};

/**
 * Stage 2 — Final Approver action
 * Actions: approved_final | rejected | changes_requested
 */
const approveReport = async (reportId, approverId, { action, comments }) => {
    const validActions = ['approved_final', 'rejected', 'changes_requested'];
    if (!validActions.includes(action)) {
        const error = new Error(`Invalid action. Must be one of: ${validActions.join(', ')}`);
        error.statusCode = 400;
        throw error;
    }

    // Rejection must include a comment (per SRS exception: UC-07)
    if (action === 'rejected' && !comments) {
        const error = new Error('A reason/comment is required when rejecting a report');
        error.statusCode = 400;
        throw error;
    }

    const report = await Report.findByPk(reportId, {
        include: [{ model: User, as: 'employee' }],
    });

    if (!report) {
        const error = new Error('Report not found');
        error.statusCode = 404;
        throw error;
    }

    if (report.status !== 'under_review') {
        const error = new Error(`Report must be in 'under_review' status for Stage 2 approval. Current: '${report.status}'`);
        error.statusCode = 400;
        throw error;
    }

    const statusMap = {
        approved_final: 'approved',
        rejected: 'rejected',
        changes_requested: 'changes_requested',
    };

    await report.update({ status: statusMap[action] });

    await ReviewLog.create({
        report_id: reportId,
        reviewer_id: approverId,
        stage: 2,
        action,
        comments: comments || null,
    });

    // Notify employee
    const actionMessages = {
        approved_final: `Your report "${report.title}" has been fully approved!`,
        rejected: `Your report "${report.title}" was rejected at final approval. Reason: ${comments}`,
        changes_requested: `Changes were requested on your report "${report.title}" by the Final Approver.`,
    };

    await notificationService.createNotification({
        user_id: report.employee_id,
        report_id: reportId,
        type: action,
        message: actionMessages[action],
    });

    // Notify admins
    const admins = await User.findAll({ where: { role: 'admin', is_active: true } });
    for (const admin of admins) {
        await notificationService.createNotification({
            user_id: admin.id,
            report_id: reportId,
            type: action,
            message: `Report "${report.title}" final status: ${statusMap[action].toUpperCase()}.`,
        });
    }

    return Report.findByPk(reportId, {
        include: [{ model: ReviewLog, as: 'reviewLogs' }],
    });
};

/**
 * Get full review audit trail for a report
 */
const getReviewLogs = async (reportId) => {
    const logs = await ReviewLog.findAll({
        where: { report_id: reportId },
        include: [{ model: User, as: 'reviewer', attributes: ['id', 'name', 'role'] }],
        order: [['created_at', 'ASC']],
    });
    return logs;
};

module.exports = { reviewReport, approveReport, getReviewLogs };