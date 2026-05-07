/**
 * utils/response.js
 * Standardizes all API responses so every controller returns the same shape.
 * Usage in a controller:
 *   res.status(200).json(success(data, 'Users fetched'));
 *   res.status(400).json(error('Validation failed', errors));
 */

const success = (data = null, message = 'Success') => ({
    success: true,
    message,
    data,
});

const error = (message = 'Something went wrong', errors = null) => ({
    success: false,
    message,
    errors,
});

const paginated = (data, { page, limit, total }) => ({
    success: true,
    message: 'Success',
    data,
    pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit),
    },
});

module.exports = { success, error, paginated };