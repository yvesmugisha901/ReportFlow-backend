/**
 * utils/fileUpload.js
 * Multer configuration for report file attachments.
 * SRS constraint: max 10MB, accepted formats: PDF, DOCX, XLSX (FR-06)
 *
 * Usage in a route:
 *   const { uploadReport } = require('../utils/fileUpload');
 *   router.post('/', protect, uploadReport.single('file'), createReport);
 *
 * The uploaded file will be on req.file — controller reads req.file.path or req.file.filename
 */

const multer = require('multer');
const path = require('path');
const AppError = require('./AppError');

const MAX_SIZE_MB = 10;
const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',       // .xlsx
    'application/msword',   // legacy .doc
    'application/vnd.ms-excel', // legacy .xls
];
const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.xlsx', '.doc', '.xls'];

// Store files in /uploads folder at project root
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../../uploads'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `report-${uniqueSuffix}${ext}`);
    },
});

const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (
        ALLOWED_MIME_TYPES.includes(file.mimetype) &&
        ALLOWED_EXTENSIONS.includes(ext)
    ) {
        cb(null, true);
    } else {
        cb(
            new AppError(
                `Invalid file type. Only PDF, DOCX, and XLSX files are allowed.`,
                400
            )
        );
    }
};

const uploadReport = multer({
    storage,
    fileFilter,
    limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
});

module.exports = { uploadReport };