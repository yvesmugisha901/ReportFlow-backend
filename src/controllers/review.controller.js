const { Report, ReviewLog, Notification, User } = require('../models');

// ─── Helper: create notification ─────────────────────────────
const notify = async (user_id, report_id, event_type, message) => {
    await Notification.create({ user_id, report_id, event_type, message });
};

// ─── GET /api/reviews/pending ─────────────────────────────────
// Returns reports waiting for the logged-in reviewer/approver
const getPendingReviews = async (req, res, next) => {
    try {
        const statusMap = {
            reviewer: 'submitted',
            approver: 'under_review',
        };

        const status = statusMap[req.user.role];
        if (!status) {
            return res.status(403).json({ success: false, error: 'Not a reviewer or approver' });
        }

        const reports = await Report.findAll({
            where: { status },
            include: [
                { association: 'employee', attributes: ['user_id', 'full_name', 'email'] },
                { association: 'schedule', attributes: ['schedule_id', 'title', 'deadline'] },
            ],
            order: [['submitted_at', 'ASC']],
        });

        res.json({ success: true, count: reports.length, reports });
    } catch (err) {
        next(err);
    }
};

// ─── POST /api/reviews/:reportId ─────────────────────────────
// Reviewer (stage_1) or Approver (stage_2) acts on a report
const reviewReport = async (req, res, next) => {
    try {
        const { action, comment } = req.body;
        const report = await Report.findByPk(req.params.reportId, {
            include: [{ association: 'employee', attributes: ['user_id', 'full_name'] }],
        });

        if (!report) {
            return res.status(404).json({ success: false, error: 'Report not found' });
        }

        // Validate action + role + current status
        const rules = {
            reviewer: { allowedStatus: 'submitted', stage: 'stage_1' },
            approver: { allowedStatus: 'under_review', stage: 'stage_2' },
        };

        const rule = rules[req.user.role];
        if (!rule) {
            return res.status(403).json({ success: false, error: 'Not authorized to review' });
        }

        if (report.status !== rule.allowedStatus) {
            return res.status(400).json({
                success: false,
                error: `Report must be '${rule.allowedStatus}' for this action`,
            });
        }

        const validActions = ['approved', 'rejected', 'changes_requested'];
        if (!validActions.includes(action)) {
            return res.status(400).json({ success: false, error: 'Invalid action' });
        }

        if (action === 'rejected' && !comment) {
            return res.status(400).json({ success: false, error: 'Comment is required when rejecting' });
        }

        // Determine new report status
        const nextStatus = {
            stage_1: {
                approved: 'under_review',
                rejected: 'rejected',
                changes_requested: 'changes_requested',
            },
            stage_2: {
                approved: 'approved',
                rejected: 'rejected',
                changes_requested: 'changes_requested',
            },
        }[rule.stage][action];

        // Save the review log
        await ReviewLog.create({
            report_id: report.report_id,
            reviewer_id: req.user.id,
            stage: rule.stage,
            action,
            comment: comment || null,
        });

        // Update report status
        await report.update({ status: nextStatus });

        // Notify the employee
        const eventMap = {
            approved: 'approved',
            rejected: 'rejected',
            changes_requested: 'changes_requested',
        };

        const msgMap = {
            approved: `Your report "${report.title}" has been approved (${rule.stage}).`,
            rejected: `Your report "${report.title}" was rejected. Reason: ${comment}`,
            changes_requested: `Changes requested on your report "${report.title}". Note: ${comment || 'See review log'}`,
        };

        await notify(report.employee_id, report.report_id, eventMap[action], msgMap[action]);

        res.json({ success: true, message: `Report ${action}`, status: nextStatus });
    } catch (err) {
        next(err);
    }
};

// ─── GET /api/reviews/:reportId/logs ─────────────────────────
// Full audit trail for a report
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


const approveReport=async(req,res,next)=>{try{const{action,comments}=req.body;if(!action)return res.status(400).json({success:false,error:'action is required'});if(action==='rejected'&&!comments)return res.status(400).json({success:false,error:'comments are required when rejecting'});const{Report,ReviewLog,User}=require('../models');const report=await Report.findByPk(req.params.reportId);if(!report)return res.status(404).json({success:false,error:'Report not found'});if(report.status!=='under_review')return res.status(400).json({success:false,error:'Report is not at stage 2'});const statusMap={approved_final:'approved',rejected:'rejected',changes_requested:'changes_requested'};await report.update({status:statusMap[action]});await ReviewLog.create({report_id:report.id,reviewer_id:req.user.id,stage:2,action,comments:comments||null});res.json({success:true,report});}catch(err){next(err);}};
module.exports = { getPendingReviews, reviewReport, approveReport, getReviewLogs };