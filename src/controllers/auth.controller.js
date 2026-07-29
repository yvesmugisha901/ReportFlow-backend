const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { User, PasswordResetToken } = require('../models');
const { sendMail } = require('../utils/mailer');
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

        const user = await User.create({
            full_name,
            email,
            password_hash,
            role: 'employee',
            dept_id: dept_id || null,
            team_id: null,
            is_active: false,
        });

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

        // ✅ Fetch full user with nested department & team associations
        const fullUser = await User.findByPk(user.user_id, {
            include: [
                { association: 'department', attributes: ['dept_id', 'name'] },
                { association: 'team', attributes: ['team_id', 'name'] },
            ],
        });

        const token = generateToken(user);

        res.json({
            success: true,
            token,
            user: fullUser, // ✅ now includes department: { dept_id, name }
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

// ─── POST /api/auth/forgot-password ──────────────────────────
const forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;

        if (!email || !email.trim()) {
            return res.status(400).json({ success: false, error: 'Email is required.' });
        }

        const user = await User.findOne({ where: { email: email.trim().toLowerCase() } });

        if (!user) {
            return res.status(200).json({
                success: true,
                message: 'If that email is registered, a reset link has been sent.',
            });
        }

        await PasswordResetToken.destroy({
            where: { user_id: user.user_id, used: false },
        });

        const rawToken = crypto.randomBytes(32).toString('hex');
        const expires_at = new Date(Date.now() + 60 * 60 * 1000);

        await PasswordResetToken.create({
            user_id: user.user_id,
            token: rawToken,
            expires_at,
        });

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const resetUrl = `${frontendUrl}/auth/reset-password?token=${rawToken}`;

        await sendMail({
            to: user.email,
            subject: 'Reset your ReportFlow password',
            html: `
                <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f8f9fc;border-radius:12px;">
                    <h2 style="color:#4f46e5;margin-bottom:8px;">Reset your password</h2>
                    <p style="color:#374151;font-size:14px;">
                        Hi ${user.full_name || user.email},<br/><br/>
                        We received a request to reset your ReportFlow password.
                        Click the button below — this link expires in <strong>1 hour</strong>.
                    </p>
                    <a href="${resetUrl}"
                       style="display:inline-block;margin:24px 0;padding:12px 24px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
                        Reset Password →
                    </a>
                    <p style="color:#6b7280;font-size:12px;">
                        If you didn't request this, you can safely ignore this email.
                    </p>
                    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
                    <p style="color:#9ca3af;font-size:11px;">ReportFlow · This is an automated message.</p>
                </div>
            `,
        });

        return res.status(200).json({
            success: true,
            message: 'If that email is registered, a reset link has been sent.',
        });
    } catch (err) {
        next(err);
    }
};

// ─── POST /api/auth/reset-password ───────────────────────────
const resetPassword = async (req, res, next) => {
    try {
        const { token, password } = req.body;

        if (!token || !password) {
            return res.status(400).json({ success: false, error: 'Token and new password are required.' });
        }
        if (password.length < 8) {
            return res.status(400).json({ success: false, error: 'Password must be at least 8 characters.' });
        }

        const record = await PasswordResetToken.findOne({
            where: {
                token,
                used: false,
                expires_at: { [Op.gt]: new Date() },
            },
        });

        if (!record) {
            return res.status(400).json({
                success: false,
                error: 'This reset link is invalid or has expired. Please request a new one.',
            });
        }

        const password_hash = await bcrypt.hash(password, 12);
        await User.update({ password_hash }, { where: { user_id: record.user_id } });
        await record.update({ used: true });

        return res.status(200).json({
            success: true,
            message: 'Password updated successfully. You can now log in.',
        });
    } catch (err) {
        next(err);
    }
};

// ─── PATCH /api/auth/profile ──────────────────────────────────
const updateProfile = async (req, res, next) => {
    try {
        const { full_name } = req.body;
        if (!full_name) return res.status(400).json({ success: false, error: 'Name is required' });

        const user = await User.findByPk(req.user.id);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });

        await user.update({ full_name });
        res.json({ success: true, message: 'Profile updated' });
    } catch (err) {
        next(err);
    }
};

// ─── PATCH /api/auth/password ─────────────────────────────────
const updatePassword = async (req, res, next) => {
    try {
        const { current_password, new_password } = req.body;
        const user = await User.scope('withPassword').findByPk(req.user.id);

        const isMatch = await bcrypt.compare(current_password, user.password_hash);
        if (!isMatch) return res.status(401).json({ success: false, error: 'Current password incorrect' });

        const password_hash = await bcrypt.hash(new_password, 12);
        await user.update({ password_hash });

        res.json({ success: true, message: 'Password updated' });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    register,
    login,
    getMe,
    forgotPassword,
    resetPassword,
    updateProfile,
    updatePassword,
};