const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/auth');
const {
    getAllDepartments,
    getDepartmentById,
    getDeptCompliance,
    createDepartment,
    updateDepartment,
    deleteDepartment,
} = require('../controllers/department.controller');

router.get('/', protect, getAllDepartments);
router.get('/:id/compliance', protect, getDeptCompliance);  // ✅ must be before /:id
router.get('/:id', protect, getDepartmentById);
router.post('/', protect, authorize('admin'), createDepartment);
router.put('/:id', protect, authorize('admin'), updateDepartment);
router.delete('/:id', protect, authorize('admin'), deleteDepartment);

module.exports = router;