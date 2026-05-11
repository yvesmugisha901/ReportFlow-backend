const { Team, Department, User } = require('../models');

// ─── GET /api/teams ───────────────────────────────────────────
const getAllTeams = async (req, res, next) => {
    try {
        // FIX: read optional dept_id filter from query string
        const { dept_id } = req.query;
        const where = dept_id ? { dept_id } : {};

        const teams = await Team.findAll({
            where,
            include: [{ association: 'department', attributes: ['dept_id', 'name'] }],
            order: [['name', 'ASC']],
        });

        res.json({ success: true, count: teams.length, teams });
    } catch (err) {
        next(err);
    }
};

// ─── GET /api/teams/:id ───────────────────────────────────────
const getTeamById = async (req, res, next) => {
    try {
        const team = await Team.findByPk(req.params.id, {
            include: [
                { association: 'department', attributes: ['dept_id', 'name'] },
                { association: 'members', attributes: ['user_id', 'full_name', 'role'] },
            ],
        });

        if (!team) {
            return res.status(404).json({ success: false, error: 'Team not found' });
        }

        res.json({ success: true, team });
    } catch (err) {
        next(err);
    }
};

// ─── POST /api/teams ──────────────────────────────────────────
const createTeam = async (req, res, next) => {
    try {
        const { name, dept_id } = req.body;

        const dept = await Department.findByPk(dept_id);
        if (!dept) {
            return res.status(404).json({ success: false, error: 'Department not found' });
        }

        const team = await Team.create({ name, dept_id });

        res.status(201).json({ success: true, team });
    } catch (err) {
        next(err);
    }
};

// ─── PUT /api/teams/:id ───────────────────────────────────────
const updateTeam = async (req, res, next) => {
    try {
        const team = await Team.findByPk(req.params.id);
        if (!team) {
            return res.status(404).json({ success: false, error: 'Team not found' });
        }

        const { name, dept_id } = req.body;
        const updates = {};
        if (name) updates.name = name;
        if (dept_id) updates.dept_id = dept_id;

        await team.update(updates);

        res.json({ success: true, team });
    } catch (err) {
        next(err);
    }
};

// ─── DELETE /api/teams/:id ────────────────────────────────────
const deleteTeam = async (req, res, next) => {
    try {
        const team = await Team.findByPk(req.params.id);
        if (!team) {
            return res.status(404).json({ success: false, error: 'Team not found' });
        }

        await team.destroy();

        res.json({ success: true, message: 'Team deleted' });
    } catch (err) {
        next(err);
    }
};

module.exports = { getAllTeams, getTeamById, createTeam, updateTeam, deleteTeam };