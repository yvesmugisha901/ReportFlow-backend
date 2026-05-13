const express = require('express');
const router = express.Router();
const { register, login, getMe, forgotPassword, resetPassword, updateProfile, updatePassword } = require('../controllers/auth.controller');
const { protect } = require('../middlewares/auth');

// POST /api/auth/register
router.post('/register', register);

// POST /api/auth/login
router.post('/login', login);

// GET /api/auth/me  ← requires token
router.get('/me', protect, getMe);

// POST /api/auth/forgot-password
router.post('/forgot-password', forgotPassword);

// POST /api/auth/reset-password
router.post('/reset-password', resetPassword);

// PATCH /api/auth/profile
router.patch('/profile', protect, updateProfile);

// PATCH /api/auth/password
router.patch('/password', protect, updatePassword);

module.exports = router;