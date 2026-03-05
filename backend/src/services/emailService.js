/**
 * Email Service — Sends password reset emails for Admin account recovery.
 *
 * Uses Nodemailer with Gmail App Passwords.
 * If SMTP credentials are not configured, logs the reset link to console
 * (useful for development).
 */

import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

let transporter = null;

// Only create transporter if SMTP credentials are configured
if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
        service: process.env.SMTP_SERVICE || 'gmail',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
} else {
    console.warn('[EMAIL] SMTP credentials not configured — reset emails will be logged to console');
}

/**
 * Send a password reset email to the admin.
 * @param {string} toEmail — admin email address
 * @param {string} resetToken — plain-text token (will be in the link)
 * @param {string} adminName — admin's display name
 */
export async function sendAdminResetEmail(toEmail, resetToken, adminName) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password/${resetToken}`;

    const subject = '🔐 JMJ Management — Admin Password Reset';
    const html = `
        <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #1e40af; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
                <h1 style="margin: 0; font-size: 24px;">JMJ Management System</h1>
            </div>
            <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
                <h2 style="color: #1e293b; margin-top: 0;">Password Reset Request</h2>
                <p style="color: #475569;">Hello <strong>${adminName}</strong>,</p>
                <p style="color: #475569;">
                    A password reset was triggered for your Admin account because of multiple failed login attempts.
                    Click the button below to set a new password:
                </p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetLink}"
                       style="background: #1e40af; color: white; padding: 12px 32px; border-radius: 6px;
                              text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
                        Reset Password
                    </a>
                </div>
                <p style="color: #64748b; font-size: 14px;">
                    This link will expire in <strong>1 hour</strong>. If you did not request this reset,
                    someone may be trying to access your account. Please secure your credentials.
                </p>
                <p style="color: #64748b; font-size: 14px;">
                    Direct link: <a href="${resetLink}" style="color: #1e40af; word-break: break-all;">${resetLink}</a>
                </p>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                <p style="color: #94a3b8; font-size: 12px; text-align: center;">
                    JMJ Bore Wells — Management System &bull; This is an automated message
                </p>
            </div>
        </div>
    `;

    const text = `Password Reset for Admin Account\n\nHello ${adminName},\n\nA password reset was triggered. Click the link below to set a new password:\n\n${resetLink}\n\nThis link expires in 1 hour.\n\nJMJ Management System`;

    if (transporter) {
        try {
            await transporter.sendMail({
                from: `"JMJ Management" <${process.env.SMTP_USER}>`,
                to: toEmail,
                subject,
                html,
                text,
            });
            console.log(`[EMAIL] Password reset email sent to ${toEmail}`);
            return true;
        } catch (error) {
            console.error('[EMAIL] Failed to send reset email:', error.message);
            return false;
        }
    } else {
        // Development fallback — log the reset link
        console.log('══════════════════════════════════════════════════');
        console.log('[EMAIL - DEV MODE] Password reset email:');
        console.log(`  To: ${toEmail}`);
        console.log(`  Reset Link: ${resetLink}`);
        console.log('══════════════════════════════════════════════════');
        return true;
    }
}

/**
 * Send a warning email when failed login attempts are detected.
 */
export async function sendLoginWarningEmail(toEmail, adminName, attempts) {
    const subject = '⚠️ JMJ Management — Suspicious Login Activity';
    const html = `
        <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
                <h1 style="margin: 0; font-size: 24px;">⚠️ Security Alert</h1>
            </div>
            <div style="background: #fef2f2; padding: 30px; border: 1px solid #fecaca; border-top: none; border-radius: 0 0 8px 8px;">
                <p style="color: #991b1b;">Hello <strong>${adminName}</strong>,</p>
                <p style="color: #991b1b;">
                    There have been <strong>${attempts} failed login attempts</strong> on your Admin account.
                    Your account has been temporarily locked for security.
                </p>
                <p style="color: #991b1b;">
                    A password reset link has been sent to this email. Please use it to regain access
                    and set a new secure password.
                </p>
                <p style="color: #991b1b; font-size: 14px;">
                    If this wasn't you, please investigate immediately.
                </p>
                <hr style="border: none; border-top: 1px solid #fecaca; margin: 20px 0;" />
                <p style="color: #94a3b8; font-size: 12px; text-align: center;">
                    JMJ Bore Wells — Management System &bull; Security Notification
                </p>
            </div>
        </div>
    `;

    if (transporter) {
        try {
            await transporter.sendMail({
                from: `"JMJ Management" <${process.env.SMTP_USER}>`,
                to: toEmail,
                subject,
                html,
            });
            console.log(`[EMAIL] Login warning sent to ${toEmail}`);
        } catch (error) {
            console.error('[EMAIL] Failed to send warning email:', error.message);
        }
    } else {
        console.log(`[EMAIL - DEV MODE] Login warning: ${attempts} failed attempts for ${adminName}`);
    }
}
