const express = require('express');
const router = express.Router();
const {
    getAllReports,
    getReportById,
    createReport,
    updateReport,
    submitReport,
    deleteReport,
} = require('../controllers/report.controller');
const { protect, authorize } = require('../middlewares/auth');

router.use(protect);

// GET /api/reports       ← filtered by role (employee sees own, reviewer/approver see assigned)
// POST /api/reports      ← employee creates
router.route('/')
    .get(getAllReports)
    .post(authorize('employee', 'admin'), createReport);

// GET/PUT/DELETE /api/reports/:id
router.route('/:id')
    .get(getReportById)
    .put(authorize('employee', 'admin'), updateReport)
    .delete(authorize('employee', 'admin'), deleteReport);

// PATCH /api/reports/:id/submit  ← employee submits for review
router.patch('/:id/submit', authorize('employee', 'admin'), submitReport);

module.exports = router;