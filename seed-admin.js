require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize } = require('./src/config/db');
const User = require('./src/models/User');

async function seedAdmin() {
    try {
        await sequelize.authenticate();
        console.log('✅ DB connected');

        const email = 'admin@company.com';
        const plainPassword = 'Admin@1234';

        const existing = await User.scope('withPassword').findOne({ where: { email } });
        if (existing) {
            console.log('⚠️  Admin already exists:', email);
            process.exit(0);
        }

        const password_hash = await bcrypt.hash(plainPassword, 10);

        await User.create({
            full_name: 'System Admin',
            email,
            password_hash,
            role: 'admin',
            dept_id: null,
            team_id: null,
            is_active: true,
        });

        console.log('✅ Admin created successfully');
        console.log('   Email:   ', email);
        console.log('   Password:', plainPassword);
        process.exit(0);
    } catch (err) {
        console.error('❌ Seed failed:', err.message);
        process.exit(1);
    }
}

seedAdmin();