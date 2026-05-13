const nodemailer = require("nodemailer");

let transporter = null;

async function getTransporter() {
    if (transporter) return transporter;

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

    console.log("[Mailer] Ethereal SMTP ready — emails will be captured, not sent.");
    console.log(`[Mailer] Account: ${testAccount.user}`);

    return transporter;
}

async function sendMail({ to, subject, html }) {
    const transport = await getTransporter();

    const info = await transport.sendMail({
        from: '"ReportFlow" <no-reply@reportflow.app>',
        to,
        subject,
        html,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);

    console.log("-----------------------------------------");
    console.log(`[Mailer] Email captured for : ${to}`);
    console.log(`[Mailer] Subject            : ${subject}`);
    console.log(`[Mailer] Preview URL        : ${previewUrl}`);
    console.log("-----------------------------------------");

    return { messageId: info.messageId, previewUrl };
}

module.exports = { sendMail };