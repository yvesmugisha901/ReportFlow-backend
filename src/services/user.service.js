const bcrypt = require('bcryptjs');
const { User, Department, Team } = require('../models');
const { Op } = require('sequelize');
const notificationService = require('./notification.service');

const userIncludes = [
    { model: Department, as: 'department', attributes: ['id', 'name'] },
    { model: Team, as: 'team', attributes: ['id', 'name'] },
];

/**
 * Get all users — admin only, supports filtering
 */
const getAllUsers = async ({ role, department_id, team_id, is_active, search } = {}) => {
    const where = {};

    if (role) where.role = role;
    if (department_id) where.department_id = department_id;
    if (team_id) where.team_id = team_id;
    if (is_active !== undefined) where.is_active = is_active;
    if (search) where.name = { [Op.iLike]: `%${search}%` };

    return User.findAll({ where, include: userIncludes, order: [['name', 'ASC']] });
};

/**
 * Get a single user by ID
 */
const getUserById = async (id) => {
    const user = await User.findByPk(id, { include: userIncludes });
    if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
    }
    return user;
};

/**
 * Create user (admin registers an employee)
 * Returns the plain password so admin can send it to the user via email
 */
const createUser = async (data) => {
    const existing = await User.findOne({ where: { email: data.email } });
    if (existing) {
        const error = new Error('Email already in use');
        error.statusCode = 409;
        throw error;
    }

    const plainPassword = Math.random().toString(36).slice(-8) + 'A1!';
    const password_hash = await bcrypt.hash(plainPassword, 12);

    const user = await User.create({ ...data, password_hash, is_active: true });

    // Send welcome notification (in-app)
    await notificationService.createNotification({
        user_id: user.id,
        type: 'general',
        message: `Welcome to the Internal Reporting System, ${user.name}! Your account is now active.`,
    });

    return { user, plainPassword };
};

/**
 * Update user — admin can change role, dept, team, name etc.
 */
const updateUser = async (id, data) => {
    const user = await getUserById(id);

    // Prevent password from being updated via this route
    delete data.password_hash;
    delete data.password;

    await user.update(data);
    return getUserById(id); // return fresh with associations
};

/**
 * Toggle user active/inactive (soft delete)
 */
const toggleUserStatus = async (id) => {
    const user = await getUserById(id);
    await user.update({ is_active: !user.is_active });
    return user;
};

/**
 * Hard delete a user — use with caution
 */
const deleteUser = async (id) => {
    const user = await getUserById(id);
    await user.destroy();
    return { message: 'User deleted successfully' };
};

/**
 * Update own profile (employee self-service)
 */
const updateOwnProfile = async (userId, { name, email }) => {
    const user = await getUserById(userId);

    if (email && email !== user.email) {
        const emailTaken = await User.findOne({ where: { email } });
        if (emailTaken) {
            const error = new Error('Email already in use');
            error.statusCode = 409;
            throw error;
        }
    }

    await user.update({ name, email });
    return getUserById(userId);
};

module.exports = {
    getAllUsers,
    getUserById,
    createUser,
    updateUser,
    toggleUserStatus,
    deleteUser,
    updateOwnProfile,
};