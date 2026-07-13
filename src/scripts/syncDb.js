require('dotenv').config();
const { sequelize } = require('../config/db');
require('../models'); // loads all models + associations

(async () => {
  try {
    await sequelize.sync({ force: true });
    console.log('✅ All tables created successfully');
    process.exit(0);
  } catch (err) {
    console.error('❌ Sync failed:', err);
    process.exit(1);
  }
})();