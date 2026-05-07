const express = require('express');
const router = express.Router();
const {
    getAllSchedules,
    getScheduleById,
    createSchedule,
    updateSchedule,
    deleteSchedule,
} = require('../controllers/schedule.controller');
const { protect, authorize } = require('../middlewares/auth');

router.use(protect);

// GET /api/schedules       ← all authenticated users can view their schedules
// POST /api/schedules      ← admin only
router.route('/')
    .get(getAllSchedules)
    .post(authorize('admin'), createSchedule);

// GET/PUT/DELETE /api/schedules/:id
router.route('/:id')
    .get(getScheduleById)
    .put(authorize('admin'), updateSchedule)
    .delete(authorize('admin'), deleteSchedule);

module.exports = router;