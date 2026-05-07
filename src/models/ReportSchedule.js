const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const ReportSchedule = sequelize.define('ReportSchedule', {
    schedule_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    title: {
        type: DataTypes.STRING(200),
        allowNull: false,
    },
    report_type: {
        type: DataTypes.STRING(100),
        allowNull: false,
    },
    frequency: {
        type: DataTypes.ENUM('weekly', 'biweekly', 'monthly', 'quarterly', 'custom'),
        allowNull: false,
    },
    start_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
    },
    deadline: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        validate: {
            isAfterStartDate(value) {
                if (value < this.start_date) {
                    throw new Error('Deadline must be on or after start date');
                }
            },
        },
    },
    dept_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'departments', key: 'dept_id' },
        onDelete: 'SET NULL',
    },
    team_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'teams', key: 'team_id' },
        onDelete: 'SET NULL',
    },
    created_by: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'user_id' },
        onDelete: 'RESTRICT',
    },
}, {
    tableName: 'report_schedules',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
});

module.exports = ReportSchedule;