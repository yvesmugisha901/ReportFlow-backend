const bcrypt = require('bcryptjs');
const { User, Department, Team } = require('../models');

// ─── GET /api/users ───────────────────────────────────────────
// Admin: all users | Others: own profile only
const getAllUsers = async (req, res, next) => {
    try {
        const users = await User.findAll({
            include: [
                { association: 'department', attributes: ['dept_id', 'name'] },
                { association: 'team', attributes: ['team_id', 'name'] },
            ],
            order: [['created_at', 'DESC']],
        });

        res.json({ success: true, count: users.length, users });
    } catch (err) {
        next(err);
    }
};

// ─── GET /api/users/:id ───────────────────────────────────────
const getUserById = async (req, res, next) => {
    try {
        const user = await User.findByPk(req.params.id, {
            include: [
                { association: 'department', attributes: ['dept_id', 'name'] },
                { association: 'team', attributes: ['team_id', 'name'] },
            ],
        });

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        res.json({ success: true, user });
    } catch (err) {
        next(err);
    }
};

// ─── PUT /api/users/:id ───────────────────────────────────────
const updateUser = async (req, res, next) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const { full_name, email, role, dept_id, team_id, password } = req.body;

        // Only admin can change roles
        if (role && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Only admin can change roles' });
        }

        const updates = {};
        if (full_name) updates.full_name = full_name;
        if (email) updates.email = email;
        if (role) updates.role = role;
        if (dept_id !== undefined) updates.dept_id = dept_id;
        if (team_id !== undefined) updates.team_id = team_id;
        if (password) updates.password_hash = await bcrypt.hash(password, 12);

        await user.update(updates);

        res.json({ success: true, user });
    } catch (err) {
        next(err);
    }
};

// ─── PATCH /api/users/:id/deactivate ─────────────────────────
// Admin only — soft delete
const deactivateUser = async (req, res, next) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        await user.update({ is_active: false });

        res.json({ success: true, message: 'User deactivated' });
    } catch (err) {
        next(err);
    }
};

// ─── PATCH /api/users/:id/activate ───────────────────────────
const activateUser = async (req, res, next) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        await user.update({ is_active: true });

        res.json({ success: true, message: 'User activated' });
    } catch (err) {
        next(err);
    }
};


const createUser=async(req,res,next)=>{try{const{full_name,email,role,dept_id,team_id}=req.body;const existing=await User.findOne({where:{email}});if(existing)return res.status(409).json({success:false,error:'Email already in use'});const plainPassword=Math.random().toString(36).slice(-8)+'A1!';const password_hash=await bcrypt.hash(plainPassword,12);const user=await User.create({full_name,email,password_hash,role,dept_id,team_id,is_active:true});res.status(201).json({success:true,user,plainPassword});}catch(err){next(err);}};
const deleteUser=async(req,res,next)=>{try{const user=await User.findByPk(req.params.id);if(!user)return res.status(404).json({success:false,error:'User not found'});await user.destroy();res.json({success:true,message:'User deleted'});}catch(err){next(err);}};
module.exports = { getAllUsers, getUserById, createUser, updateUser, deleteUser, deactivateUser, activateUser };