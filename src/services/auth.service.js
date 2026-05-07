const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Department, Team } = require('../models');

/**
 * Generate a signed JWT token for a user
 */
const generateToken = (userId) => {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });
};

/**
 * Register a new user (admin only flow — called from admin panel)
 * Generates a random password and returns it so admin can email the user
 */
const registerUser = async ({ name, email, role, department_id, team_id }) => {
    const existing = await User.findOne({ where: { email } });
    if (existing) {
        const error = new Error('A user with this email already exists');
        error.statusCode = 409;
        throw error;
    }

    // Generate a random password — admin sends it to the employee
    const plainPassword = Math.random().toString(36).slice(-8) + 'A1!';
    const password_hash = await bcrypt.hash(plainPassword, 12);

    const user = await User.create({
        name,
        email,
        password_hash,
        role,
        department_id: department_id || null,
        team_id: team_id || null,
        is_active: true,
    });

    return { user, plainPassword };
};

/**
 * Login — verify credentials and return user + token
 */
const loginUser = async (email, password) => {
    // Find user including password_hash (excluded in default scope)
    const user = await User.scope('withPassword').findOne({ where: { email } });

    if (!user) {
        const error = new Error('Invalid email or password');
        error.statusCode = 401;
        throw error;
    }

    if (!user.is_active) {
        const error = new Error('Your account has been deactivated. Contact the administrator.');
        error.statusCode = 403;
        throw error;
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
        const error = new Error('Invalid email or password');
        error.statusCode = 401;
        throw error;
    }

    const token = generateToken(user.id);

    // Return user without password
    const { password_hash: _, ...userWithoutPassword } = user.toJSON();
    return { user: userWithoutPassword, token };
};

/**
 * Change password — for employees updating their own password
 */
const changePassword = async (userId, currentPassword, newPassword) => {
    const user = await User.scope('withPassword').findByPk(userId);
    if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
        const error = new Error('Current password is incorrect');
        error.statusCode = 400;
        throw error;
    }

    const password_hash = await bcrypt.hash(newPassword, 12);
    await user.update({ password_hash });

    return { message: 'Password updated successfully' };
};

/**
 * Get current user with department + team populated
 */
const getMe = async (userId) => {
    const user = await User.findByPk(userId, {
        include: [
            { model: Department, as: 'department', attributes: ['id', 'name'] },
            { model: Team, as: 'team', attributes: ['id', 'name'] },
        ],
    });

    if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
    }

    return user;
};

module.exports = { registerUser, loginUser, changePassword, getMe, generateToken };