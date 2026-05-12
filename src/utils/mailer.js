const nodemailer = require("nodemailer");

let transporter = null;

/**
 * Returns a cached Ethereal transporter.
 * Ethereal is a fake SMTP service — emails never actually send,
 * but you get a preview URL in the console to "view" the email.
 */
async function getTransporter() {
    if (transporter) return transporter;

    // Create a one-time Ethereal test account
    const testAccount = await nodemailer.createTestAccount();

    transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
            user: testAccount.user,
            pass: testAccount.pass,
        },
    });

    console.log("📧 Ethereal SMTP ready — emails will be captured (not sent).");
    console.log(`   Account: ${testAccount.user}`);

    return transporter;
}

/**
 * Send an email and log the Ethereal preview URL.
 * @param {Object} options - { to, subject, html }
 */
async function sendMail({ to, subject, html }) {
    const transport = await getTransporter();

    const info = await transport.sendMail({
        from: '"ReportFlow" <no-reply@reportflow.app>',
        to,
        subject,
        html,
    });

    // This URL lets you VIEW the captured email in a browser
    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log("─────────────────────────────────────────");
    console.log(`📬 Email captured for: ${to}`);
    console.log(`   Subject : ${subject}`);
    console.log(`   Preview : ${previewUrl}`);
    console.log("─────────────────────────────────────────");

    return { messageId: info.messageId, previewUrl };
}

module.exports = { sendMail };