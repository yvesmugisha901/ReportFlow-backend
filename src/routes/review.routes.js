const express = require('express');
const router = express.Router();
const {
    getPendingReviews,
    reviewReport,
    getReviewLogs,
    getMyReviewHistory,
} = require('../controllers/review.controller');
const { protect, authorize } = require('../middlewares/auth');

router.use(protect);

// ⚠️ ALL static routes must be declared before /:reportId
// to prevent Express swallowing them as a param

// GET /api/reviews/logs            ← full audit trail, admin only
router.get('/logs', authorize('admin'), getReviewLogs);

// GET /api/reviews/my-history      ← logged-in reviewer/approver's own action history
router.get('/my-history', authorize('reviewer', 'approver', 'admin'), getMyReviewHistory);

// GET /api/reviews/pending         ← reviewer sees submitted, approver sees under_review
router.get('/pending', authorize('reviewer', 'approver', 'admin'), getPendingReviews);

// POST /api/reviews/:reportId      ← unified action for stage 1 and stage 2
router.post('/:reportId', authorize('reviewer', 'approver', 'admin'), reviewReport);

// GET /api/reviews/:reportId/logs  ← audit trail for a specific report
router.get('/:reportId/logs', getReviewLogs);

module.exports = router;