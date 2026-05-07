/**
 * utils/pagination.js
 * Extracts pagination params from req.query and builds Sequelize limit/offset.
 *
 * Usage in a controller:
 *   const { limit, offset, page } = getPagination(req.query);
 *   const { count, rows } = await Model.findAndCountAll({ where, limit, offset });
 *   res.json(paginated(rows, { page, limit, total: count }));
 */

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const getPagination = (query = {}) => {
    const page = Math.max(1, parseInt(query.page) || DEFAULT_PAGE);
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(query.limit) || DEFAULT_LIMIT));
    const offset = (page - 1) * limit;
    return { page, limit, offset };
};

module.exports = { getPagination };