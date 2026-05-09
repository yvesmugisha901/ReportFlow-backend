const express = require('express');
const router = express.Router();
const {
    getAllUsers,
    getPendingUsers,
    approveUser,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
    deactivateUser,
    activateUser,
} = require('../controllers/user.controller');
const { protect, authorize } = require('../middlewares/auth');

router.use(protect);

// ── Pending approvals (must be before /:id to avoid conflict) ──
router.get('/pending', authorize('admin'), getPendingUsers);

// ── Main CRUD ──────────────────────────────────────────────────
router.route('/')
    .get(authorize('admin'), getAllUsers)
    .post(authorize('admin'), createUser);

router.route('/:id')
    .get(authorize('admin'), getUserById)
    .put(authorize('admin'), updateUser)
    .delete(authorize('admin'), deleteUser);

// ── Status patches ─────────────────────────────────────────────
router.patch('/:id/approve', authorize('admin'), approveUser);
router.patch('/:id/deactivate', authorize('admin'), deactivateUser);
router.patch('/:id/activate', authorize('admin'), activateUser);

module.exports = router;