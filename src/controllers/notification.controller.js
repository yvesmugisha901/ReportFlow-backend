const { Notification } = require('../models');

// ─── GET /api/notifications ───────────────────────────────────
// Returns all notifications for the logged-in user
const getMyNotifications = async (req, res, next) => {
    try {
        const notifications = await Notification.findAll({
            where: { user_id: req.user.id },
            order: [['created_at', 'DESC']],
        });

        const unreadCount = notifications.filter((n) => !n.is_read).length;

        res.json({ success: true, unreadCount, notifications });
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

        res.json({ success: true, message: 'Marked as read' });
    } catch (err) {
        next(err);
    }
};

// ─── PATCH /api/notifications/read-all ───────────────────────
const markAllAsRead = async (req, res, next) => {
    try {
        await Notification.update(
            { is_read: true },
            { where: { user_id: req.user.id, is_read: false } }
        );

        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (err) {
        next(err);
    }
};

module.exports = { getMyNotifications, markAsRead, markAllAsRead };