const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Team = sequelize.define('Team', {
    team_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false,
    },
    dept_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'departments', key: 'dept_id' },
        onDelete: 'CASCADE',
    },
}, {
    tableName: 'teams',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
        { unique: true, fields: ['name', 'dept_id'] },
    ],
});

module.exports = Team;