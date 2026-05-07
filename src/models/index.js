// ─── Models Index — loads all models and defines associations ─
const Department = require('./Department');
const Team = require('./Team');
const User = require('./User');
const ReportSchedule = require('./ReportSchedule');
const Report = require('./Report');
const ReviewLog = require('./ReviewLog');
const Notification = require('./Notification');

// ─────────────────────────────────────────────────────────────
// ASSOCIATIONS
// ─────────────────────────────────────────────────────────────

// Department <-> Team
Department.hasMany(Team, { foreignKey: 'dept_id', as: 'teams' });
Team.belongsTo(Department, { foreignKey: 'dept_id', as: 'department' });

// Department <-> User (reviewer)
Department.belongsTo(User, { foreignKey: 'reviewer_id', as: 'reviewer' });
User.hasMany(Department, { foreignKey: 'reviewer_id', as: 'reviewedDepartments' });

// User <-> Department / Team membership
User.belongsTo(Department, { foreignKey: 'dept_id', as: 'department' });
User.belongsTo(Team, { foreignKey: 'team_id', as: 'team' });
Department.hasMany(User, { foreignKey: 'dept_id', as: 'members' });
Team.hasMany(User, { foreignKey: 'team_id', as: 'members' });

// ReportSchedule
ReportSchedule.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
ReportSchedule.belongsTo(Department, { foreignKey: 'dept_id', as: 'department' });
ReportSchedule.belongsTo(Team, { foreignKey: 'team_id', as: 'team' });
ReportSchedule.hasMany(Report, { foreignKey: 'schedule_id', as: 'reports' });

// Report
Report.belongsTo(ReportSchedule, { foreignKey: 'schedule_id', as: 'schedule' });
Report.belongsTo(User, { foreignKey: 'employee_id', as: 'employee' });
User.hasMany(Report, { foreignKey: 'employee_id', as: 'reports' });

// ReviewLog
ReviewLog.belongsTo(Report, { foreignKey: 'report_id', as: 'report' });
ReviewLog.belongsTo(User, { foreignKey: 'reviewer_id', as: 'reviewer' });
Report.hasMany(ReviewLog, { foreignKey: 'report_id', as: 'reviewLogs' });
User.hasMany(ReviewLog, { foreignKey: 'reviewer_id', as: 'reviewActions' });

// Notification
Notification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Notification.belongsTo(Report, { foreignKey: 'report_id', as: 'report' });
User.hasMany(Notification, { foreignKey: 'user_id', as: 'notifications' });
Report.hasMany(Notification, { foreignKey: 'report_id', as: 'notifications' });

// ─────────────────────────────────────────────────────────────

module.exports = {
    Department,
    Team,
    User,
    ReportSchedule,
    Report,
    ReviewLog,
    Notification,
};