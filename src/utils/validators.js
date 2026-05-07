/**
 * utils/validators.js
 * Lightweight validation helpers used in controllers before data reaches services.
 * Returns { valid: true } or { valid: false, errors: [...] }
 *
 * No third-party library needed — keeps the package footprint small.
 */

/**
 * Check that all required fields are present and non-empty
 */
const requireFields = (body, fields) => {
    const missing = fields.filter(
        (f) => body[f] === undefined || body[f] === null || String(body[f]).trim() === ''
    );
    if (missing.length) {
        return { valid: false, errors: missing.map((f) => `${f} is required`) };
    }
    return { valid: true };
};

/**
 * Validate email format
 */
const isValidEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
};

/**
 * Validate password strength — min 8 chars, 1 uppercase, 1 number
 */
const isStrongPassword = (password) => {
    return (
        typeof password === 'string' &&
        password.length >= 8 &&
        /[A-Z]/.test(password) &&
        /[0-9]/.test(password)
    );
};

/**
 * Validate allowed roles
 */
const VALID_ROLES = ['admin', 'employee', 'reviewer', 'approver'];
const isValidRole = (role) => VALID_ROLES.includes(role);

/**
 * Validate report frequency values
 */
const VALID_FREQUENCIES = ['weekly', 'bi-weekly', 'monthly', 'custom'];
const isValidFrequency = (freq) => VALID_FREQUENCIES.includes(freq);

/**
 * Validate review actions for stage 1
 */
const VALID_STAGE1_ACTIONS = ['approved_stage1', 'rejected', 'changes_requested'];
const isValidStage1Action = (action) => VALID_STAGE1_ACTIONS.includes(action);

/**
 * Validate review actions for stage 2
 */
const VALID_STAGE2_ACTIONS = ['approved_final', 'rejected', 'changes_requested'];
const isValidStage2Action = (action) => VALID_STAGE2_ACTIONS.includes(action);

/**
 * Full login validation
 */
const validateLogin = (body) => {
    const check = requireFields(body, ['email', 'password']);
    if (!check.valid) return check;

    if (!isValidEmail(body.email)) {
        return { valid: false, errors: ['Invalid email format'] };
    }
    return { valid: true };
};

/**
 * Full register/create user validation
 */
const validateCreateUser = (body) => {
    const check = requireFields(body, ['name', 'email', 'role']);
    if (!check.valid) return check;

    const errors = [];
    if (!isValidEmail(body.email)) errors.push('Invalid email format');
    if (!isValidRole(body.role)) errors.push(`role must be one of: ${VALID_ROLES.join(', ')}`);

    return errors.length ? { valid: false, errors } : { valid: true };
};

/**
 * Report submission validation
 */
const validateCreateReport = (body) => {
    const check = requireFields(body, ['title', 'schedule_id']);
    if (!check.valid) return check;

    if (!body.content && !body.file_url) {
        return { valid: false, errors: ['Either content or a file_url is required'] };
    }
    return { valid: true };
};

/**
 * Schedule creation validation
 */
const validateCreateSchedule = (body) => {
    const check = requireFields(body, ['title', 'frequency', 'deadline']);
    if (!check.valid) return check;

    const errors = [];
    if (!isValidFrequency(body.frequency)) {
        errors.push(`frequency must be one of: ${VALID_FREQUENCIES.join(', ')}`);
    }
    if (isNaN(Date.parse(body.deadline))) {
        errors.push('deadline must be a valid date');
    }
    return errors.length ? { valid: false, errors } : { valid: true };
};

module.exports = {
    requireFields,
    isValidEmail,
    isStrongPassword,
    isValidRole,
    isValidFrequency,
    isValidStage1Action,
    isValidStage2Action,
    validateLogin,
    validateCreateUser,
    validateCreateReport,
    validateCreateSchedule,
    VALID_ROLES,
    VALID_FREQUENCIES,
};