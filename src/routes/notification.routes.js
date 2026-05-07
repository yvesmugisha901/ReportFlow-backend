const express = require('express');
const router = express.Router();
const {
    getMyNotifications,
    markAsRead,
    markAllAsRead,
} = require('../controllers/notification.controller');
const { protect } = require('../middlewares/auth');

router.use(protect);

// GET /api/notifications          ← get all for logged-in user
router.get('/', getMyNotifications);

// PATCH /api/notifications/read-all  ← mark all as read
router.patch('/read-all', markAllAsRead);

// PATCH /api/notifications/:id/read  ← mark single as read
router.patch('/:id/read', markAsRead);

module.exports = router;