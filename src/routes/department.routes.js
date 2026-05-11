const express = require('express');
const router = express.Router();
const {
    getAllDepartments,
    getDepartmentById,
    createDepartment,
    updateDepartment,
    deleteDepartment,
} = require('../controllers/department.controller');
const { protect, authorize } = require('../middlewares/auth');

// ─── PUBLIC (no token required) ───────────────────────────────
// Used on the register page before the user has a token
router.get('/', getAllDepartments);

// ─── PROTECTED (token required from here down) ────────────────
router.use(protect);

// GET/PUT/DELETE /api/departments/:id
router.route('/:id')
    .get(getDepartmentById)
    .put(authorize('admin'), updateDepartment)
    .delete(authorize('admin'), deleteDepartment);

// POST /api/departments      ← admin only
router.post('/', authorize('admin'), createDepartment);

module.exports = router;