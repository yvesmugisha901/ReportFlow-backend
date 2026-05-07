/**
 * utils/AppError.js
 * A structured error class used across services and controllers.
 * The global errorHandler middleware (middlewares/errorHandler.js) catches
 * instances of this class and returns the correct HTTP status + message.
 *
 * Usage in a service:
 *   throw new AppError('User not found', 404);
 *   throw new AppError('Email already in use', 409);
 *   throw new AppError('Access denied', 403);
 */

class AppError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true; // flag to distinguish from unexpected crashes
        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = AppError;