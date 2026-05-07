const { Notification, User } = require('../models');

/**
 * Create a notification for a user
 * Called internally by report/review services
 */
const createNotification = async ({ user_id, report_id = null, type, message }) => {
    return Notification.create({
        user_id,
        report_id,
        type,
        message,
        is_read: false,
    });
};

/**
 * Get all notifications for a user, unread first
 */
const getNotifications = async (userId) => {
    return Notification.findAll({
        where: { user_id: userId },
        order: [
            ['is_read', 'ASC'],   // unread first
            ['created_at', 'DESC'],
        ],
    });
};

/**
 * Mark a single notification as read
 */
const markAsRead = async (notificationId, userId) => {
    const notification = await Notification.findOne({
        where: { id: notificationId, user_id: userId },
    });

    if (!notification) {
        const error = new Error('Notification not found');
        error.statusCode = 404;
        throw error;
    }

    await notification.update({ is_read: true });
    return notification;
};

/**
 * Mark all notifications as read for a user
 */
const markAllAsRead = async (userId) => {
    await Notification.update(
        { is_read: true },
        { where: { user_id: userId, is_read: false } }
    );
    return { message: 'All notifications marked as read' };
};

/**
 * Get unread count — useful for the notification bell badge
 */
const getUnreadCount = async (userId) => {
    const count = await Notification.count({
        where: { user_id: userId, is_read: false },
    });
    return { unread_count: count };
};

module.exports = {
    createNotification,
    getNotifications,
    markAsRead,
    markAllAsRead,
    getUnreadCount,
};