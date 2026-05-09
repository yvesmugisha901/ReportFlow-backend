const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
require('dotenv').config();

// ─── Generate JWT ─────────────────────────────────────────────
const generateToken = (user) => {
    return jwt.sign(
        { id: user.user_id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
};

// ─── POST /api/auth/register ──────────────────────────────────
// Registers employee as inactive — admin must approve before they can log in
const register = async (req, res, next) => {
    try {
        const { full_name, email, password, dept_id } = req.body;

        if (!full_name || !email || !password) {
            return res.status(400).json({ success: false, error: 'full_name, email, and password are required' });
        }

        const existing = await User.scope('withPassword').findOne({ where: { email } });
        if (existing) {
            return res.status(400).json({ success: false, error: 'Email already registered' });
        }

        const password_hash = await bcrypt.hash(password, 12);

        // Always register as employee, always inactive — admin activates + assigns team
        const user = await User.create({
            full_name,
            email,
            password_hash,
            role: 'employee',
            dept_id: dept_id || null,
            team_id: null,
            is_active: false,
        });

        // No token — user cannot log in until admin approves
        res.status(201).json({
            success: true,
            message: 'Registration successful. Your account is pending admin approval.',
            user: {
                user_id: user.user_id,
                full_name: user.full_name,
                email: user.email,
                role: user.role,
                dept_id: user.dept_id,
                is_active: false,
            },
        });
    } catch (err) {
        next(err);
    }
};

// ─── POST /api/auth/login ─────────────────────────────────────
const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        const user = await User.scope('withPassword').findOne({ where: { email } });
        if (!user) {
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }

        // Clear message for pending accounts
        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                error: 'Your account is pending admin approval. You will be notified once activated.',
                pending: true,
            });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }

        const token = generateToken(user);

        res.json({
            success: true,
            token,
            user: {
                user_id: user.user_id,
                full_name: user.full_name,
                email: user.email,
                role: user.role,
                dept_id: user.dept_id,
                team_id: user.team_id,
            },
        });
    } catch (err) {
        next(err);
    }
};

// ─── GET /api/auth/me ─────────────────────────────────────────
const getMe = async (req, res, next) => {
    try {
        const user = await User.findByPk(req.user.id, {
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

module.exports = { register, login, getMe };