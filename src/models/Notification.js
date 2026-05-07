const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Notification = sequelize.define('Notification', {
    notif_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'user_id' },
        onDelete: 'CASCADE',
    },
    report_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'reports', key: 'report_id' },
        onDelete: 'SET NULL',
    },
    event_type: {
        type: DataTypes.STRING(50),
        allowNull: false,
        // values: 'report_due' | 'submitted' | 'reviewed' | 'approved' | 'rejected'
    },
    message: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    is_read: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
}, {
    tableName: 'notifications',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
});

module.exports = Notification;