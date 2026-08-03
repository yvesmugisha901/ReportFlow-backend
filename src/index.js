require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const { connectDB } = require('./config/db');
const errorHandler = require('./middlewares/errorHandler');

// Route imports
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const departmentRoutes = require('./routes/department.routes');
const teamRoutes = require('./routes/team.routes');
const scheduleRoutes = require('./routes/schedule.routes');
const reportRoutes = require('./routes/report.routes');
const reviewRoutes = require('./routes/review.routes');
const notificationRoutes = require('./routes/notification.routes');

const app = express();

// ─── Global Middleware ────────────────────────────────────────────────────────
// CLIENT_URL can be a single origin or a comma-separated list, e.g.:
//   CLIENT_URL=http://localhost:3000,http://reportflow.local
// This lets the same backend serve both direct Next.js dev access and the
// nginx-proxied domain without hardcoding one origin.
const CLIENT_URLS = (process.env.CLIENT_URL || 'http://localhost:3000,http://reportflow.local')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);

app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                ...helmet.contentSecurityPolicy.getDefaultDirectives(),
                "frame-ancestors": ["'self'", ...CLIENT_URLS],
            },
        },
        crossOriginResourcePolicy: false, // allow /uploads to be fetched cross-origin
    })
);

app.use(
    cors({
        origin: (origin, callback) => {
            // Allow requests with no origin (curl, Postman, server-to-server)
            if (!origin) return callback(null, true);

            if (CLIENT_URLS.includes(origin)) {
                return callback(null, true);
            }

            return callback(new Error(`CORS blocked for origin: ${origin}`));
        },
        credentials: true,
    })
);

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ─── Static file serving (uploaded reports) ───────────────────────────────────
app.use('/uploads', (req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Content-Security-Policy', `frame-ancestors 'self' ${CLIENT_URLS.join(' ')}`);
    next();
}, express.static(path.join(__dirname, 'uploads')));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', require('./routes/dashboard.routes'));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Global Error Handler (must be last) ─────────────────────────────────────
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

const start = async () => {
    await connectDB();
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`   Allowed origins: ${CLIENT_URLS.join(', ')}`);
    });
};

start();