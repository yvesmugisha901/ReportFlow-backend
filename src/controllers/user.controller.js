    const bcrypt = require('bcryptjs');
    const { Op } = require('sequelize');
    const { User, Department, Team } = require('../models');

    // ─── GET /api/users ───────────────────────────────────────────
    // Supports: ?search=&role=&dept_id=&is_active=
    const getAllUsers = async (req, res, next) => {
        try {
            const { search, role, dept_id, is_active } = req.query;
            const where = {};

            if (role) where.role = role;
            if (dept_id) where.dept_id = dept_id;

            if (is_active !== undefined) where.is_active = is_active === 'true';

            if (search) {
                where[Op.or] = [
                    { full_name: { [Op.iLike]: `%${search}%` } },
                    { email: { [Op.iLike]: `%${search}%` } },
                ];
            }

            const users = await User.findAll({
                where,
                include: [
                    { association: 'department', attributes: ['dept_id', 'name'] },
                    { association: 'team', attributes: ['team_id', 'name'] },
                ],
                order: [['created_at', 'DESC']],
            });

            res.json({ success: true, count: users.length, users });
        } catch (err) {
            next(err);
        }
    };

    // ─── GET /api/users/pending ───────────────────────────────────
    // Returns all users with is_active=false (awaiting admin approval)
    const getPendingUsers = async (req, res, next) => {
        try {
            const users = await User.findAll({
                where: { is_active: false },
                include: [
                    { association: 'department', attributes: ['dept_id', 'name'] },
                ],
                order: [['created_at', 'DESC']],
            });

            res.json({ success: true, count: users.length, users });
        } catch (err) {
            next(err);
        }
    };

    // ─── PATCH /api/users/:id/approve ────────────────────────────
    // Admin assigns team_id and activates the account in one action
    const approveUser = async (req, res, next) => {
        try {
            const user = await User.findByPk(req.params.id);
            if (!user) {
                return res.status(404).json({ success: false, error: 'User not found' });
            }

            if (user.is_active) {
                return res.status(400).json({ success: false, error: 'User is already active' });
            }

            const { team_id } = req.body;

            // team_id is optional — some depts may not use teams yet
            await user.update({
                is_active: true,
                team_id: team_id || null,
            });

            // Return full user with associations
            const updated = await User.findByPk(user.user_id, {
                include: [
                    { association: 'department', attributes: ['dept_id', 'name'] },
                    { association: 'team', attributes: ['team_id', 'name'] },
                ],
            });

            res.json({
                success: true,
                message: `${user.full_name} has been approved and can now log in.`,
                user: updated,
            });
        } catch (err) {
            next(err);
        }
    };

    // ─── GET /api/users/:id ───────────────────────────────────────
    const getUserById = async (req, res, next) => {
        try {
            const user = await User.findByPk(req.params.id, {
                include: [
                    { association: 'department', attributes: ['dept_id', 'name'] },
                    { association: 'team', attributes: ['team_id', 'name'] },
                ],
            });

            if (!user) {
                return res.status(404).json({ success: false, error: 'User not found' });
            }

            res.json({ success: true, user });
        } catch (err) {
            next(err);
        }
    };

    // ─── PUT /api/users/:id ───────────────────────────────────────
    const updateUser = async (req, res, next) => {
        try {
            const user = await User.findByPk(req.params.id);
            if (!user) {
                return res.status(404).json({ success: false, error: 'User not found' });
            }

            const { full_name, email, role, dept_id, team_id, password } = req.body;

            if (role && req.user.role !== 'admin') {
                return res.status(403).json({ success: false, error: 'Only admin can change roles' });
            }

            const updates = {};
            if (full_name) updates.full_name = full_name;
            if (email) updates.email = email;
            if (role) updates.role = role;
            if (dept_id !== undefined) updates.dept_id = dept_id || null;
            if (team_id !== undefined) updates.team_id = team_id || null;
            if (password) updates.password_hash = await bcrypt.hash(password, 12);

            await user.update(updates);
            res.json({ success: true, user });
        } catch (err) {
            next(err);
        }
    };

    // ─── PATCH /api/users/:id/deactivate ─────────────────────────
    const deactivateUser = async (req, res, next) => {
        try {
            const user = await User.findByPk(req.params.id);
            if (!user) return res.status(404).json({ success: false, error: 'User not found' });
            await user.update({ is_active: false });
            res.json({ success: true, message: 'User deactivated' });
        } catch (err) {
            next(err);
        }
    };

    // ─── PATCH /api/users/:id/activate ───────────────────────────
    const activateUser = async (req, res, next) => {
        try {
            const user = await User.findByPk(req.params.id);
            if (!user) return res.status(404).json({ success: false, error: 'User not found' });
            await user.update({ is_active: true });
            res.json({ success: true, message: 'User activated' });
        } catch (err) {
            next(err);
        }
    };

    // ─── POST /api/users ──────────────────────────────────────────
    const createUser = async (req, res, next) => {
        try {
            const { full_name, email, role, dept_id, team_id } = req.body;

            const existing = await User.findOne({ where: { email } });
            if (existing) return res.status(409).json({ success: false, error: 'Email already in use' });

            const plainPassword = Math.random().toString(36).slice(-8) + 'A1!';
            const password_hash = await bcrypt.hash(plainPassword, 12);

            const user = await User.create({
                full_name,
                email,
                password_hash,
                role,
                dept_id: dept_id || null,
                team_id: team_id || null,
                is_active: true,
            });

            res.status(201).json({ success: true, user, plainPassword });
        } catch (err) {
            next(err);
        }
    };

    // ─── DELETE /api/users/:id ────────────────────────────────────
    const deleteUser = async (req, res, next) => {
        try {
            const user = await User.findByPk(req.params.id);
            if (!user) return res.status(404).json({ success: false, error: 'User not found' });
            await user.destroy();
            res.json({ success: true, message: 'User deleted' });
        } catch (err) {
            next(err);
        }
    };

    module.exports = {
        getAllUsers,
        getPendingUsers,
        approveUser,
        getUserById,
        createUser,
        updateUser,
        deleteUser,
        deactivateUser,
        activateUser,
    };