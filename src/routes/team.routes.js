const express = require('express');
const router = express.Router();
const {
    getAllTeams,
    getTeamById,
    createTeam,
    updateTeam,
    deleteTeam,
} = require('../controllers/team.controller');
const { protect, authorize } = require('../middlewares/auth');

router.use(protect);

// GET /api/teams       ← all authenticated users
// POST /api/teams      ← admin only
router.route('/')
    .get(getAllTeams)
    .post(authorize('admin'), createTeam);

// GET/PUT/DELETE /api/teams/:id
router.route('/:id')
    .get(getTeamById)
    .put(authorize('admin'), updateTeam)
    .delete(authorize('admin'), deleteTeam);

module.exports = router;