const express = require('express');
const router = express.Router();
const {
    reviewReport,
    approveReport,
    getReviewLogs,
} = require('../controllers/review.controller');
const { protect, authorize } = require('../middlewares/auth');

router.use(protect);

// POST /api/reviews/:reportId/review   ← stage 1: reviewer approves/rejects
router.post('/:reportId/review', authorize('reviewer', 'admin'), reviewReport);

// POST /api/reviews/:reportId/approve  ← stage 2: approver final decision
router.post('/:reportId/approve', authorize('approver', 'admin'), approveReport);

// GET /api/reviews/:reportId/logs      ← full audit trail for a report
router.get('/:reportId/logs', getReviewLogs);

module.exports = router;