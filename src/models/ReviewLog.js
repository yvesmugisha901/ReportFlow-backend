const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const ReviewLog = sequelize.define('ReviewLog', {
    log_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    report_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'reports', key: 'report_id' },
        onDelete: 'CASCADE',
    },
    reviewer_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'user_id' },
        onDelete: 'RESTRICT',
    },
    stage: {
        type: DataTypes.ENUM('stage_1', 'stage_2'),
        allowNull: false,
    },
    action: {
        type: DataTypes.ENUM('approved', 'rejected', 'changes_requested'),
        allowNull: false,
    },
    comment: {
        type: DataTypes.TEXT,
        allowNull: true, // required at app layer when action = 'rejected'
    },
}, {
    tableName: 'review_logs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false, // immutable audit log — never update
});

module.exports = ReviewLog;