const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const PasswordResetToken = sequelize.define(
    'PasswordResetToken',
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        token: {
            type: DataTypes.STRING(64),
            allowNull: false,
            unique: true,
        },
        expires_at: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        used: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    },
    {
        tableName: 'password_reset_tokens',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false,
    }
);

module.exports = PasswordResetToken;