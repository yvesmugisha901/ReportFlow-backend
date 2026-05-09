const dashboardService = require('../services/dashboard.service');

const getAdminDashboard = async (req, res, next) => {
    try {
        const data = await dashboardService.getAdminDashboard();
        res.json({ success: true, ...data });
    } catch (err) {
        next(err);
    }
};

const getApproverDashboard = async (req, res, next) => {
    try {
        const data = await dashboardService.getApproverDashboard();
        res.json({ success: true, ...data });
    } catch (err) {
        next(err);
    }
};

const getDepartmentDashboard = async (req, res, next) => {
    try {
        const deptId = req.params.id ?? req.user.department_id;
        const data = await dashboardService.getDepartmentDashboard(deptId);
        res.json({ success: true, ...data });
    } catch (err) {
        next(err);
    }
};

const getReviewerDashboard = async (req, res, next) => {
    try {
        const data = await dashboardService.getReviewerDashboard(req.user);
        res.json({ success: true, ...data });
    } catch (err) {
        next(err);
    }
};

const getEmployeeDashboard = async (req, res, next) => {
    try {
        const data = await dashboardService.getEmployeeDashboard(req.user);
        res.json({ success: true, ...data });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getAdminDashboard,
    getApproverDashboard,
    getDepartmentDashboard,
    getReviewerDashboard,
    getEmployeeDashboard,
};