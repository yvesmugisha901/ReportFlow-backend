const express = require('express');
const router = express.Router();
const {
    getAllUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
    deactivateUser,
    activateUser,
} = require('../controllers/user.controller');
const { protect, authorize } = require('../middlewares/auth');

router.use(protect);

router.route('/')
    .get(authorize('admin'), getAllUsers)
    .post(authorize('admin'), createUser);

router.route('/:id')
    .get(authorize('admin'), getUserById)
    .put(authorize('admin'), updateUser)
    .delete(authorize('admin'), deleteUser);

router.patch('/:id/deactivate', authorize('admin'), deactivateUser);
router.patch('/:id/activate', authorize('admin'), activateUser);

module.exports = router;