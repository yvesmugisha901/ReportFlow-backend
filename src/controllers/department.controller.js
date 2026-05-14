const { Op } = require('sequelize');
const { Department, User, Team } = require('../models');

// ─── GET /api/departments ─────────────────────────────────────
const getAllDepartments = async (req, res, next) => {
    try {
        const departments = await Department.findAll({
            include: [
                { association: 'reviewer', attributes: ['user_id', 'full_name', 'email'] },
                { association: 'teams', attributes: ['team_id', 'name'] },
            ],
            order: [['name', 'ASC']],
        });

        res.json({ success: true, count: departments.length, departments });
    } catch (err) {
        next(err);
    }
};

// ─── GET /api/departments/:id ─────────────────────────────────
const getDepartmentById = async (req, res, next) => {
    try {
        const dept = await Department.findByPk(req.params.id, {
            include: [
                { association: 'reviewer', attributes: ['user_id', 'full_name', 'email'] },
                { association: 'teams', attributes: ['team_id', 'name'] },
                { association: 'members', attributes: ['user_id', 'full_name', 'role'] },
            ],
        });

        if (!dept) {
            return res.status(404).json({ success: false, error: 'Department not found' });
        }

        res.json({ success: true, department: dept });
    } catch (err) {
        next(err);
    }
};

// ─── GET /api/departments/:id/compliance ─────────────────────
const getDeptCompliance = async (req, res, next) => {
    try {
        const { Report } = require('../models');
        const { id } = req.params;

        const dept = await Department.findByPk(id);
        if (!dept) {
            return res.status(404).json({ success: false, error: 'Department not found' });
        }

        // Total active employees in this department
        const total = await User.count({
            where: { dept_id: id, is_active: true, role: 'employee' },
        });

        // Reports submitted this calendar month from employees in this dept
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const submitted = await Report.count({
            where: { submitted_at: { [Op.gte]: startOfMonth } },
            include: [{
                association: 'employee',
                attributes: [],
                where: { dept_id: id },
                required: true,
            }],
        });

        res.json({
            success: true,
            dept_id: id,
            name: dept.name,
            submitted,
            total,
        });
    } catch (err) {
        next(err);
    }
};

// ─── POST /api/departments ────────────────────────────────────
const createDepartment = async (req, res, next) => {
    try {
        const { name, description, reviewer_id } = req.body;

        const dept = await Department.create({ name, description, reviewer_id: reviewer_id || null });

        res.status(201).json({ success: true, department: dept });
    } catch (err) {
        next(err);
    }
};

// ─── PUT /api/departments/:id ─────────────────────────────────
const updateDepartment = async (req, res, next) => {
    try {
        const dept = await Department.findByPk(req.params.id);
        if (!dept) {
            return res.status(404).json({ success: false, error: 'Department not found' });
        }

        const { name, description, reviewer_id } = req.body;
        const updates = {};
        if (name) updates.name = name;
        if (description !== undefined) updates.description = description;
        if (reviewer_id !== undefined) updates.reviewer_id = reviewer_id;

        await dept.update(updates);

        res.json({ success: true, department: dept });
    } catch (err) {
        next(err);
    }
};

// ─── DELETE /api/departments/:id ──────────────────────────────
const deleteDepartment = async (req, res, next) => {
    try {
        const dept = await Department.findByPk(req.params.id);
        if (!dept) {
            return res.status(404).json({ success: false, error: 'Department not found' });
        }

        await dept.destroy();

        res.json({ success: true, message: 'Department deleted' });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getAllDepartments,
    getDepartmentById,
    getDeptCompliance, // ✅ new
    createDepartment,
    updateDepartment,
    deleteDepartment,
};