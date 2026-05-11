const express = require('express');
const router = express.Router();
const {
    getMyNotifications,
    markAsRead,
    markAllAsRead,
    getUnreadCount,
    deleteNotification,
    deleteAllRead,
} = require('../controllers/notification.controller');
const { protect } = require('../middlewares/auth');

router.use(protect);

// ⚠️ Static routes before /:id param routes
router.get('/', getMyNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/mark-all-read', markAllAsRead);   // matches frontend
router.patch('/read-all', markAllAsRead);        // keep old one too for safety
router.delete('/read', deleteAllRead);           // delete all read notifications
router.patch('/:id/read', markAsRead);
router.delete('/:id', deleteNotification);       // delete single notification

module.exports = router;