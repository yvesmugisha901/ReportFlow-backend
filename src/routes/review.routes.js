const express = require('express');
const router = express.Router();
const {
    getPendingReviews,
    reviewReport,
    getReviewLogs,
} = require('../controllers/review.controller');
const { protect, authorize } = require('../middlewares/auth');

router.use(protect);

// GET /api/reviews/pending             ← reviewer sees submitted, approver sees under_review
router.get('/pending', authorize('reviewer', 'approver', 'admin'), getPendingReviews);

// POST /api/reviews/:reportId          ← unified action for both stage 1 and stage 2
router.post('/:reportId', authorize('reviewer', 'approver', 'admin'), reviewReport);

// GET /api/reviews/:reportId/logs      ← full audit trail
router.get('/:reportId/logs', getReviewLogs);

module.exports = router;