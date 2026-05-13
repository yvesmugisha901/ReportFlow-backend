const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { User, Department, Team } = require('../models');
const { sendMail } = require('../utils/mailer');

// ─── Email template ───────────────────────────────────────────
function welcomeEmailHtml({ full_name, email, password, role }) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to ReportFlow</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);padding:36px 40px 28px;text-align:center;">
              <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:12px;padding:10px 20px;margin-bottom:16px;">
                <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.5px;">ReportFlow</span>
              </div>
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Welcome, ${full_name}</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Your account has been created by an administrator.</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;">
                Hi <strong>${full_name}</strong>, your <strong>ReportFlow</strong> account is ready.
                Use the credentials below to sign in for the first time.
                You will be prompted to change your password after signing in.
              </p>

              <!-- Credentials box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f7ff;border:1px solid #e0e7ff;border-radius:12px;margin-bottom:28px;">
                <tr>
                  <td style="padding:24px 28px;">
                    <p style="margin:0 0 16px;font-size:11px;font-weight:600;color:#6366f1;text-transform:uppercase;letter-spacing:0.8px;">Your Login Credentials</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;">
                          <span style="font-size:12px;color:#9ca3af;font-weight:500;">Email</span>
                        </td>
                        <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;text-align:right;">
                          <span style="font-size:13px;color:#111827;font-weight:600;">${email}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;">
                          <span style="font-size:12px;color:#9ca3af;font-weight:500;">Temporary Password</span>
                        </td>
                        <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;text-align:right;">
                          <code style="font-size:15px;font-weight:700;color:#4f46e5;background:#ede9fe;padding:3px 10px;border-radius:6px;letter-spacing:1px;">${password}</code>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0;">
                          <span style="font-size:12px;color:#9ca3af;font-weight:500;">Role</span>
                        </td>
                        <td style="padding:10px 0;text-align:right;">
                          <span style="font-size:12px;font-weight:600;color:#ffffff;background:#4f46e5;padding:2px 10px;border-radius:20px;text-transform:capitalize;">${role}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Warning -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;margin-bottom:28px;">
                <tr>
                  <td style="padding:14px 18px;">
                    <p style="margin:0;font-size:13px;color:#92400e;">
                      <strong>Important:</strong> This is a temporary password.
                      Please change it immediately after your first login to keep your account secure.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">
                If you have any questions, contact your system administrator.<br/>
                Do not reply to this email — it is sent from an unmonitored address.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #f0f0f0;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#9ca3af;">
                &copy; ${new Date().getFullYear()} ReportFlow &middot; This is an automated message
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
}

// ─── GET /api/users ───────────────────────────────────────────
const getAllUsers = async (req, res, next) => {
    try {
        const { search, role, dept_id, is_active } = req.query;
        const where = {};

        if (role) where.role = role;
        if (dept_id) where.dept_id = dept_id;
        if (is_active !== undefined) where.is_active = is_active === 'true';

        if (search) {
            where[Op.or] = [
                { full_name: { [Op.iLike]: `%${search}%` } },
                { email: { [Op.iLike]: `%${search}%` } },
            ];
        }

        const users = await User.findAll({
            where,
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

// ─── GET /api/users/pending ───────────────────────────────────
const getPendingUsers = async (req, res, next) => {
    try {
        const users = await User.findAll({
            where: { is_active: false },
            include: [{ association: 'department', attributes: ['dept_id', 'name'] }],
            order: [['created_at', 'DESC']],
        });
        res.json({ success: true, count: users.length, users });
    } catch (err) {
        next(err);
    }
};

// ─── PATCH /api/users/:id/approve ────────────────────────────
const approveUser = async (req, res, next) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        if (user.is_active) return res.status(400).json({ success: false, error: 'User is already active' });

        const { team_id } = req.body;
        await user.update({ is_active: true, team_id: team_id || null });

        const updated = await User.findByPk(user.user_id, {
            include: [
                { association: 'department', attributes: ['dept_id', 'name'] },
                { association: 'team', attributes: ['team_id', 'name'] },
            ],
        });

        res.json({
            success: true,
            message: `${user.full_name} has been approved and can now log in.`,
            user: updated,
        });
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
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        res.json({ success: true, user });
    } catch (err) {
        next(err);
    }
};

// ─── PUT /api/users/:id ───────────────────────────────────────
const updateUser = async (req, res, next) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });

        const { full_name, email, role, dept_id, team_id, password } = req.body;

        if (role && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Only admin can change roles' });
        }

        const updates = {};
        if (full_name) updates.full_name = full_name;
        if (email) updates.email = email;
        if (role) updates.role = role;
        if (dept_id !== undefined) updates.dept_id = dept_id || null;
        if (team_id !== undefined) updates.team_id = team_id || null;
        if (password) updates.password_hash = await bcrypt.hash(password, 12);

        await user.update(updates);
        res.json({ success: true, user });
    } catch (err) {
        next(err);
    }
};

// ─── PATCH /api/users/:id/deactivate ─────────────────────────
const deactivateUser = async (req, res, next) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
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
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        await user.update({ is_active: true });
        res.json({ success: true, message: 'User activated' });
    } catch (err) {
        next(err);
    }
};

// ─── POST /api/users ──────────────────────────────────────────
const createUser = async (req, res, next) => {
    try {
        const { full_name, email, role, dept_id, team_id } = req.body;

        const existing = await User.findOne({ where: { email } });
        if (existing) {
            return res.status(409).json({ success: false, error: 'Email already in use' });
        }

        const plainPassword = Math.random().toString(36).slice(-8) + 'A1!';
        const password_hash = await bcrypt.hash(plainPassword, 12);

        const user = await User.create({
            full_name,
            email,
            password_hash,
            role,
            dept_id: dept_id || null,
            team_id: team_id || null,
            is_active: true,
        });

        // Send welcome email with credentials
        try {
            const { previewUrl } = await sendMail({
                to: email,
                subject: 'Your ReportFlow account is ready',
                html: welcomeEmailHtml({ full_name, email, password: plainPassword, role }),
            });

            return res.status(201).json({
                success: true,
                user,
                plainPassword,
                emailPreview: previewUrl,
            });
        } catch (mailErr) {
            console.error('[Mailer] Welcome email failed (user was still created):', mailErr.message);

            return res.status(201).json({
                success: true,
                user,
                plainPassword,
                emailPreview: null,
                emailError: 'Email could not be sent — share the password with the employee manually.',
            });
        }
    } catch (err) {
        next(err);
    }
};

// ─── DELETE /api/users/:id ────────────────────────────────────
const deleteUser = async (req, res, next) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        await user.destroy();
        res.json({ success: true, message: 'User deleted' });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getAllUsers,
    getPendingUsers,
    approveUser,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
    deactivateUser,
    activateUser,
};