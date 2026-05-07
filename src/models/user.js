const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const User = sequelize.define('User', {
    user_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    full_name: {
        type: DataTypes.STRING(150),
        allowNull: false,
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        validate: { isEmail: true },
    },
    password_hash: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    role: {
        type: DataTypes.ENUM('admin', 'employee', 'reviewer', 'approver'),
        allowNull: false,
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
    is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    },
}, {
    tableName: 'users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    defaultScope: {
        attributes: { exclude: ['password_hash'] }, // never return password by default
    },
    scopes: {
        withPassword: { attributes: {} }, // use User.scope('withPassword') when needed
    },
});

module.exports = User;