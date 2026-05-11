const { Notification } = require('../models');

// ─── GET /api/notifications ───────────────────────────────────
const getMyNotifications = async (req, res, next) => {
    try {
        const notifications = await Notification.findAll({
            where: { user_id: req.user.id },
            order: [['created_at', 'DESC']],
        });

        const unreadCount = notifications.filter(n => !n.is_read).length;

        res.set('Cache-Control', 'no-store');
        res.json({ success: true, unreadCount, notifications });
    } catch (err) {
        next(err);
    }
};

// ─── GET /api/notifications/unread-count ─────────────────────
const getUnreadCount = async (req, res, next) => {
    try {
        const count = await Notification.count({
            where: { user_id: req.user.id, is_read: false },
        });

        res.set('Cache-Control', 'no-store');
        res.json({ success: true, count });
    } catch (err) {
        next(err);
    }
};

// ─── PATCH /api/notifications/:id/read ───────────────────────
const markAsRead = async (req, res, next) => {
    try {
        const notif = await Notification.findOne({
            where: { notif_id: req.params.id, user_id: req.user.id },
        });

        if (!notif) {
            return res.status(404).json({ success: false, error: 'Notification not found' });
        }

        await notif.update({ is_read: true });

        res.set('Cache-Control', 'no-store');
        res.json({ success: true, message: 'Marked as read' });
    } catch (err) {
        next(err);
    }
};

// ─── PATCH /api/notifications/mark-all-read ──────────────────
const markAllAsRead = async (req, res, next) => {
    try {
        await Notification.update(
            { is_read: true },
            { where: { user_id: req.user.id, is_read: false } }
        );

        res.set('Cache-Control', 'no-store');
        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (err) {
        next(err);
    }
};

// ─── DELETE /api/notifications/:id ───────────────────────────
const deleteNotification = async (req, res, next) => {
    try {
        const notif = await Notification.findOne({
            where: { notif_id: req.params.id, user_id: req.user.id },
        });

        if (!notif) {
            return res.status(404).json({ success: false, error: 'Notification not found' });
        }

        await notif.destroy();

        res.set('Cache-Control', 'no-store');
        res.json({ success: true, message: 'Notification deleted' });
    } catch (err) {
        next(err);
    }
};

// ─── DELETE /api/notifications/read ──────────────────────────
const deleteAllRead = async (req, res, next) => {
    try {
        await Notification.destroy({
            where: { user_id: req.user.id, is_read: true },
        });

        res.set('Cache-Control', 'no-store');
        res.json({ success: true, message: 'All read notifications deleted' });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getMyNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllRead,
};