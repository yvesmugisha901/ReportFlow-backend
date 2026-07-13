const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Report = sequelize.define('Report', {
    report_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    schedule_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'report_schedules', key: 'schedule_id' },
        onDelete: 'RESTRICT',
    },
    employee_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'user_id' },
        onDelete: 'RESTRICT',
    },
    title: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    file_path: {
        type: DataTypes.STRING(500),
        allowNull: true,
    },
    file_name: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    status: {
        type: DataTypes.ENUM(
            'pending',
            'submitted',
            'under_review',
            'changes_requested',
            'approved',
            'rejected'
        ),
        allowNull: false,
        defaultValue: 'pending',
    },
    is_late: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    submitted_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
}, {
    tableName: 'reports',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    validate: {
        contentOrFile() {
            if (!this.content && !this.file_path) {
                throw new Error('Report must have either content text or a file upload');
            }
        },
    },
});

module.exports = Report;