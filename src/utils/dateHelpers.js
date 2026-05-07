/**
 * utils/dateHelpers.js
 * Date utilities shared across services (schedule, report, dashboard).
 */

/**
 * Check if a deadline has already passed
 */
const isPastDeadline = (deadline) => {
    return new Date() > new Date(deadline);
};

/**
 * How many days until a deadline (negative = already past)
 */
const daysUntil = (deadline) => {
    const diff = new Date(deadline).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

/**
 * Check if a deadline falls within N days from now
 * Used by the cron reminder job in schedule.service.js
 */
const isWithinDays = (deadline, days, toleranceMinutes = 30) => {
    const target = Date.now() + days * 24 * 60 * 60 * 1000;
    const tolerance = toleranceMinutes * 60 * 1000;
    const deadlineMs = new Date(deadline).getTime();
    return Math.abs(deadlineMs - target) <= tolerance;
};

/**
 * Format a date to a readable string e.g. "May 7, 2026 at 14:30"
 */
const formatDate = (date) => {
    return new Date(date).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

/**
 * Get the start and end of the current month
 * Used in dashboard.service.js for "current reporting period"
 */
const currentMonthRange = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return { start, end };
};

module.exports = { isPastDeadline, daysUntil, isWithinDays, formatDate, currentMonthRange };