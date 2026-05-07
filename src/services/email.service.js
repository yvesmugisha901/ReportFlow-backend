const nodemailer = require('nodemailer');

/**
 * Create the transporter once — reuse across calls
 */
const createTransporter = () => {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false, // true for port 465
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
};

/**
 * Base send function
 */
const sendEmail = async ({ to, subject, html }) => {
    // Skip silently in test environment
    if (process.env.NODE_ENV === 'test') return;

    try {
        const transporter = createTransporter();
        await transporter.sendMail({
            from: `"${process.env.EMAIL_FROM_NAME || 'Reporting System'}" <${process.env.SMTP_USER}>`,
            to,
            subject,
            html,
        });
        console.log(`📧 Email sent to ${to}: ${subject}`);
    } catch (err) {
        // Log but don't crash the app — email is non-critical
        console.error(`❌ Failed to send email to ${to}:`, err.message);
    }
};

// ─── Email Templates ──────────────────────────────────────────────────────────

/**
 * Welcome email — sent when admin registers a new employee (FR-03)
 */
const sendWelcomeEmail = async (user, plainPassword) => {
    await sendEmail({
        to: user.email,
        subject: 'Welcome to the Internal Reporting System',
        html: `
      <h2>Welcome, ${user.name}!</h2>
      <p>Your account has been created. Use the credentials below to log in:</p>
      <table>
        <tr><td><strong>Email:</strong></td><td>${user.email}</td></tr>
        <tr><td><strong>Password:</strong></td><td>${plainPassword}</td></tr>
      </table>
      <p>Please change your password after your first login.</p>
      <p><a href="${process.env.CLIENT_URL}/login">Log in now</a></p>
    `,
    });
};

/**
 * Notify reviewer that a new report has been submitted
 */
const sendReportSubmittedEmail = async (reviewer, report, employee) => {
    await sendEmail({
        to: reviewer.email,
        subject: `New Report Submitted: ${report.title}`,
        html: `
      <h2>Report Submitted for Review</h2>
      <p><strong>${employee.name}</strong> has submitted a report that requires your review.</p>
      <ul>
        <li><strong>Report:</strong> ${report.title}</li>
        <li><strong>Submitted:</strong> ${new Date(report.submitted_at).toLocaleString()}</li>
        ${report.is_late ? '<li style="color:red"><strong>⚠ This report was submitted late</strong></li>' : ''}
      </ul>
      <p><a href="${process.env.CLIENT_URL}/reports/${report.id}">Review the report</a></p>
    `,
    });
};

/**
 * Notify employee of Stage 1 result
 */
const sendStage1ResultEmail = async (employee, report, action, comments) => {
    const resultText = {
        approved_stage1: '✅ Approved at Stage 1 — forwarded for final approval',
        rejected: '❌ Rejected',
        changes_requested: '🔄 Changes Requested',
    };

    await sendEmail({
        to: employee.email,
        subject: `Report Update: ${report.title}`,
        html: `
      <h2>Your Report Has Been Reviewed (Stage 1)</h2>
      <p><strong>Report:</strong> ${report.title}</p>
      <p><strong>Result:</strong> ${resultText[action]}</p>
      ${comments ? `<p><strong>Comments:</strong> ${comments}</p>` : ''}
      <p><a href="${process.env.CLIENT_URL}/reports/${report.id}">View report</a></p>
    `,
    });
};

/**
 * Notify employee of final approval result
 */
const sendFinalApprovalEmail = async (employee, report, action, comments) => {
    const resultText = {
        approved_final: '✅ Fully Approved',
        rejected: '❌ Rejected',
        changes_requested: '🔄 Changes Requested by Final Approver',
    };

    await sendEmail({
        to: employee.email,
        subject: `Final Decision on Your Report: ${report.title}`,
        html: `
      <h2>Final Approval Decision</h2>
      <p><strong>Report:</strong> ${report.title}</p>
      <p><strong>Decision:</strong> ${resultText[action]}</p>
      ${comments ? `<p><strong>Comments:</strong> ${comments}</p>` : ''}
      <p><a href="${process.env.CLIENT_URL}/reports/${report.id}">View report</a></p>
    `,
    });
};

/**
 * Deadline reminder email (FR-05)
 */
const sendDeadlineReminderEmail = async (employee, schedule, daysLeft) => {
    await sendEmail({
        to: employee.email,
        subject: `Reminder: Report Due in ${daysLeft} Day${daysLeft > 1 ? 's' : ''}`,
        html: `
      <h2>Report Deadline Reminder</h2>
      <p>Hi ${employee.name},</p>
      <p>This is a reminder that your report is due soon:</p>
      <ul>
        <li><strong>Report:</strong> ${schedule.title}</li>
        <li><strong>Deadline:</strong> ${new Date(schedule.deadline).toLocaleString()}</li>
        <li><strong>Due in:</strong> ${daysLeft} day${daysLeft > 1 ? 's' : ''}</li>
      </ul>
      <p><a href="${process.env.CLIENT_URL}/reports/new">Submit your report</a></p>
    `,
    });
};

module.exports = {
    sendWelcomeEmail,
    sendReportSubmittedEmail,
    sendStage1ResultEmail,
    sendFinalApprovalEmail,
    sendDeadlineReminderEmail,
};