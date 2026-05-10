const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const {
    getAllReports,
    getReportById,
    createReport,
    updateReport,
    submitReport,
    deleteReport,
} = require('../controllers/report.controller');
const { protect, authorize } = require('../middlewares/auth');

// ── Multer setup ──────────────────────────────────────────────
const uploadDir = path.join(__dirname, '../uploads/reports');

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${unique}${path.extname(file.originalname)}`);
    },
});

const fileFilter = (_req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error(`File type not allowed: ${ext}`), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 },
});

// ── Rewrite disk path → public URL path ──────────────────────
// Saves "/uploads/reports/filename.pdf" to DB instead of the
// full absolute disk path, so the frontend can use it directly.
function normalizeFilePath(req, _res, next) {
    if (req.file) {
        const filename = path.basename(req.file.path);
        req.file.path = `/uploads/reports/${filename}`;
    }
    next();
}

router.use(protect);

router.route('/')
    .get(getAllReports)
    .post(authorize('employee', 'admin'), upload.single('file'), normalizeFilePath, createReport);

router.route('/:id')
    .get(getReportById)
    .put(authorize('employee', 'admin'), upload.single('file'), normalizeFilePath, updateReport)
    .delete(authorize('employee', 'admin'), deleteReport);

router.patch('/:id/submit', authorize('employee', 'admin'), submitReport);

module.exports = router;