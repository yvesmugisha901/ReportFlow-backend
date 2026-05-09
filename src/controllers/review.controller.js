const { Report, ReviewLog, Notification, User, Department } = require('../models');

const notify = async (user_id, report_id, event_type, message) => {
    try {
        await Notification.create({ user_id, report_id, event_type, message });
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
            // Reviewer only sees reports from their own department (submitted status)
            const reviewer = await User.findByPk(userId);
            if (!reviewer?.dept_id) {
                return res.json({ success: true, count: 0, reports: [] });
            }

            // Get all employee IDs in this department
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
            // Approver sees all reports that passed stage 1
            where = { status: 'under_review' };
        } else {
            return res.status(403).json({ success: false, error: 'Not a reviewer or approver' });
        }

        const reports = await Report.findAll({
            where,
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

// ─── POST /api/reviews/:reportId ─────────────────────────────
const reviewReport = async (req, res, next) => {
    try {
        const { action, comment } = req.body;
        const { role, id: reviewerId } = req.user;

        const report = await Report.findByPk(req.params.reportId, {
            include: [{ association: 'employee', attributes: ['user_id', 'full_name'] }],
        });

        if (!report) {
            return res.status(404).json({ success: false, error: 'Report not found' });
        }

        // Role rules
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

        // Validate action
        // Frontend sends: "approve" | "changes" | "reject"
        // Map to backend values
        const actionMap = {
            approve: 'approved',
            changes: 'changes_requested',
            reject: 'rejected',
            // also accept direct backend values
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

        // Next report status
        const nextStatus = {
            stage_1: {
                approved: 'under_review',      // passes to stage 2
                rejected: 'rejected',
                changes_requested: 'changes_requested',
            },
            stage_2: {
                approved: 'approved',          // final approval
                rejected: 'rejected',
                changes_requested: 'changes_requested',
            },
        }[rule.stage][normalizedAction];

        // Save review log — stage as string consistently
        await ReviewLog.create({
            report_id: report.report_id,
            reviewer_id: reviewerId,
            stage: rule.stage,         // 'stage_1' or 'stage_2'
            action: normalizedAction,
            comment: comment?.trim() || null,
        });

        // Update report status
        await report.update({ status: nextStatus });

        // Notify employee
        const msgMap = {
            approved: rule.stage === 'stage_1'
                ? `Your report "${report.title}" passed Stage 1 review and is now with the final approver.`
                : `Your report "${report.title}" has been fully approved! 🎉`,
            rejected: `Your report "${report.title}" was rejected. ${comment ? `Reason: ${comment}` : ''}`,
            changes_requested: `Changes requested on "${report.title}". ${comment ? `Note: ${comment}` : 'See review log for details.'}`,
        };

        await notify(report.employee_id, report.report_id, normalizedAction, msgMap[normalizedAction]);

        res.json({ success: true, message: `Report ${normalizedAction}`, status: nextStatus });
    } catch (err) {
        next(err);
    }
};

// ─── GET /api/reviews/:reportId/logs ─────────────────────────
const getReviewLogs = async (req, res, next) => {
    try {
        const logs = await ReviewLog.findAll({
            where: { report_id: req.params.reportId },
            include: [{ association: 'reviewer', attributes: ['user_id', 'full_name', 'role'] }],
            order: [['created_at', 'ASC']],
        });
        res.json({ success: true, logs });
    } catch (err) {
        next(err);
    }
};

module.exports = { getPendingReviews, reviewReport, getReviewLogs };