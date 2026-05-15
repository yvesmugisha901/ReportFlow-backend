const { Report, ReviewLog, Notification, User, Department } = require('../models');

const notify = async (user_id, report_id, event_type, message) => {
    try {
        await Notification.create({ user_id, report_id, event_type, message, is_read: false });
    } catch (err) {
        console.error('Notification error:', err.message);
    }
};

// ─── GET /api/reviews/pending ─────────────────────────────────
const getPendingReviews = async (req, res, next) => {
    try {
        const { role, id: userId } = req.user;

        let where = {};

        if (role === 'reviewer') {
            const reviewer = await User.findByPk(userId);
            if (!reviewer?.dept_id) {
                return res.json({ success: true, count: 0, reports: [] });
            }

            const members = await User.findAll({
                where: { dept_id: reviewer.dept_id },
                attributes: ['user_id'],
            });
            const employeeIds = members.map(m => m.user_id);

            where = {
                status: 'submitted',
                employee_id: employeeIds.length ? employeeIds : [-1],
            };

        } else if (role === 'approver') {
            where = { status: 'under_review' };

        } else if (role === 'admin') {
            where = { status: ['submitted', 'under_review'] };

        } else {
            return res.status(403).json({ success: false, error: 'Not authorized to view pending reviews' });
        }

        const reports = await Report.findAll({
            where,
            include: [
                {
                    association: 'employee',
                    attributes: ['user_id', 'full_name', 'email'],
                    include: [{ association: 'department', attributes: ['dept_id', 'name'] }],
                },
                {
                    association: 'schedule',
                    attributes: ['schedule_id', 'title', 'deadline', 'frequency'],
                },
                {
                    association: 'reviewLogs',
                    include: [{ association: 'reviewer', attributes: ['user_id', 'full_name', 'role'] }],
                    separate: true,
                    order: [['created_at', 'ASC']],
                },
            ],
            order: [['submitted_at', 'ASC']],
        });

        res.json({ success: true, count: reports.length, reports });
    } catch (err) {
        next(err);
    }
};

// ─── POST /api/reviews/:reportId ──────────────────────────────
const reviewReport = async (req, res, next) => {
    try {
        const { action, comment } = req.body;
        const { role, id: reviewerId } = req.user;

        const report = await Report.findByPk(req.params.reportId, {
            include: [
                { association: 'employee', attributes: ['user_id', 'full_name', 'dept_id'] },
            ],
        });

        if (!report) {
            return res.status(404).json({ success: false, error: 'Report not found' });
        }

        const rules = {
            reviewer: { allowedStatus: 'submitted', stage: 'stage_1' },
            approver: { allowedStatus: 'under_review', stage: 'stage_2' },
        };

        const rule = rules[role];
        if (!rule) {
            return res.status(403).json({ success: false, error: 'Not authorized to review' });
        }

        if (report.status !== rule.allowedStatus) {
            return res.status(400).json({
                success: false,
                error: `Report must be '${rule.allowedStatus}' for this action. Current: '${report.status}'`,
            });
        }

        const actionMap = {
            approve: 'approved',
            changes: 'changes_requested',
            reject: 'rejected',
            approved: 'approved',
            changes_requested: 'changes_requested',
            rejected: 'rejected',
        };

        const normalizedAction = actionMap[action];
        if (!normalizedAction) {
            return res.status(400).json({ success: false, error: `Invalid action: '${action}'` });
        }

        if (normalizedAction === 'rejected' && !comment?.trim()) {
            return res.status(400).json({ success: false, error: 'Comment is required when rejecting' });
        }

        const nextStatus = {
            stage_1: {
                approved: 'under_review',
                rejected: 'rejected',
                changes_requested: 'changes_requested',
            },
            stage_2: {
                approved: 'final_approved',
                rejected: 'rejected',
                changes_requested: 'changes_requested',
            },
        }[rule.stage][normalizedAction];

        await ReviewLog.create({
            report_id: report.report_id,
            reviewer_id: reviewerId,
            stage: rule.stage,
            action: normalizedAction,
            comment: comment?.trim() || null,
        });

        await report.update({ status: nextStatus });

        // ── Notify the employee ────────────────────────────────
        const employeeMessages = {
            stage_1: {
                approved: `Your report "${report.title}" passed Stage 1 review and is now with the final approver.`,
                rejected: `Your report "${report.title}" was rejected. ${comment ? `Reason: ${comment}` : ''}`,
                changes_requested: `Changes requested on "${report.title}". ${comment ? `Note: ${comment}` : 'See review log for details.'}`,
            },
            stage_2: {
                approved: `Your report "${report.title}" has been fully approved!`,
                rejected: `Your report "${report.title}" was rejected at final approval. ${comment ? `Reason: ${comment}` : ''}`,
                changes_requested: `Changes requested on "${report.title}" by the final approver. ${comment ? `Note: ${comment}` : ''}`,
            },
        };

        await notify(
            report.employee_id,
            report.report_id,
            normalizedAction === 'approved' && rule.stage === 'stage_2' ? 'final_approved' : normalizedAction,
            employeeMessages[rule.stage][normalizedAction]
        );

        // ── Stage 1 approved → notify all active approvers ────
        if (rule.stage === 'stage_1' && normalizedAction === 'approved') {
            const approvers = await User.findAll({ where: { role: 'approver', is_active: true } });
            for (const approver of approvers) {
                await notify(
                    approver.user_id,
                    report.report_id,
                    'under_review',
                    `Report "${report.title}" by ${report.employee?.full_name ?? 'an employee'} passed Stage 1 and is awaiting your final approval.`
                );
            }
        }

        // ── Stage 2 acted → notify the department reviewer ────
        if (rule.stage === 'stage_2') {
            const deptId = report.employee?.dept_id;
            if (deptId) {
                const reviewer = await User.findOne({
                    where: { role: 'reviewer', dept_id: deptId, is_active: true },
                });
                if (reviewer) {
                    const reviewerMessages = {
                        approved: `Report "${report.title}" you reviewed has been fully approved by the final approver.`,
                        rejected: `Report "${report.title}" you reviewed was rejected at final approval. ${comment ? `Reason: ${comment}` : ''}`,
                        changes_requested: `The final approver requested changes on report "${report.title}" you reviewed.`,
                    };
                    await notify(
                        reviewer.user_id,
                        report.report_id,
                        normalizedAction === 'approved' ? 'final_approved' : normalizedAction,
                        reviewerMessages[normalizedAction]
                    );
                }
            }

            // ── Stage 2 acted → notify all admins ─────────────
            const admins = await User.findAll({ where: { role: 'admin', is_active: true } });
            for (const admin of admins) {
                if (admin.user_id === reviewerId) continue;
                await notify(
                    admin.user_id,
                    report.report_id,
                    normalizedAction === 'approved' ? 'final_approved' : normalizedAction,
                    `Report "${report.title}" final decision: ${nextStatus.replace(/_/g, ' ').toUpperCase()}.`
                );
            }
        }

        res.json({ success: true, message: `Report ${normalizedAction}`, status: nextStatus });
    } catch (err) {
        next(err);
    }
};

// ─── GET /api/reviews/logs ────────────────────────────────────
const getReviewLogs = async (req, res, next) => {
    try {
        const { reportId } = req.params;

        const whereClause = reportId ? { report_id: reportId } : {};

        const logs = await ReviewLog.findAll({
            where: whereClause,
            include: [
                {
                    association: 'reviewer',
                    attributes: ['user_id', 'full_name', 'role'],
                },
                ...(!reportId ? [{
                    association: 'report',
                    attributes: ['report_id', 'title', 'status'],
                    include: [{
                        association: 'employee',
                        attributes: ['user_id', 'full_name'],
                    }],
                }] : []),
            ],
            order: [['created_at', reportId ? 'ASC' : 'DESC']],
        });

        res.json({ success: true, count: logs.length, logs });
    } catch (err) {
        next(err);
    }
};

// ─── GET /api/reviews/my-history ─────────────────────────────
const getMyReviewHistory = async (req, res, next) => {
    try {
        const { id: reviewerId } = req.user;

        const logs = await ReviewLog.findAll({
            where: { reviewer_id: reviewerId },
            include: [
                {
                    association: 'report',
                    attributes: ['report_id', 'title', 'status', 'submitted_at'],
                    include: [
                        {
                            association: 'employee',
                            attributes: ['user_id', 'full_name', 'email'],
                            include: [{ association: 'department', attributes: ['dept_id', 'name'] }],
                        },
                        {
                            association: 'schedule',
                            attributes: ['schedule_id', 'title', 'deadline', 'frequency'],
                        },
                    ],
                },
            ],
            order: [['created_at', 'DESC']],
        });

        res.json({ success: true, count: logs.length, logs });
    } catch (err) {
        next(err);
    }
};

module.exports = { getPendingReviews, reviewReport, getReviewLogs, getMyReviewHistory };