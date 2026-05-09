const express = require('express');
const router = express.Router();
const {
    getAdminDashboard,
    getDepartmentDashboard,
    getReviewerDashboard,
    getEmployeeDashboard,
} = require('../controllers/dashboard.controller');
const { protect, authorize } = require('../middlewares/auth');

router.use(protect);

router.get('/admin', authorize('admin'), getAdminDashboard);
router.get('/reviewer', authorize('admin', 'reviewer'), getReviewerDashboard);
router.get('/employee', authorize('admin', 'employee'), getEmployeeDashboard);
router.get('/department/:id', authorize('admin', 'reviewer'), getDepartmentDashboard);

module.exports = router;