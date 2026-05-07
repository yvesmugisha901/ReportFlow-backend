/**
 * utils/asyncHandler.js
 * Wraps async controller functions so you never need try/catch in controllers.
 * Any thrown error (including AppError instances from services) is automatically
 * passed to Express's next(err) → errorHandler middleware.
 *
 * Usage in a controller:
 *   const { asyncHandler } = require('../utils/asyncHandler');
 *
 *   exports.getUsers = asyncHandler(async (req, res) => {
 *     const users = await userService.getAllUsers();
 *     res.json(success(users));
 *   });
 */

const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = { asyncHandler };