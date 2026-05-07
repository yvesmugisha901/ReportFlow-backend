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

router.use(protect);

// GET /api/departments       ← all authenticated users can view
// POST /api/departments      ← admin only
router.route('/')
    .get(getAllDepartments)
    .post(authorize('admin'), createDepartment);

// GET/PUT/DELETE /api/departments/:id
router.route('/:id')
    .get(getDepartmentById)
    .put(authorize('admin'), updateDepartment)
    .delete(authorize('admin'), deleteDepartment);

module.exports = router;