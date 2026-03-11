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

function resolveFrontendUrl() {
  const configuredUrl = process.env.FRONTEND_URL?.trim();
  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, '');
  }

  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (process.env.NODE_ENV === 'production') {
    if (vercelUrl) {
      return `https://${vercelUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}`;
    }

    throw new Error('FRONTEND_URL is required in production to generate password reset links');
  }

  return 'http://localhost:5173';
}

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
  const frontendUrl = resolveFrontendUrl();
    const resetLink = `${frontendUrl}/reset-password/${resetToken}`;

    const subject = '🔐 JMJ Management — Admin Password Reset';
    const html = `
        <!doctype html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <title>Reset your password — JMJ Management System</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
          </style>
        </head>
        <body style="margin:0; padding:0; background-color:#f3f4f6; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">

          <!-- Neutral Outer Background -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6;">
            <tr>
              <td align="center" style="padding:40px 16px;">

                <!-- Center Container (600px) -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; width:100%; margin:0 auto;">
                  
                  <!-- Main Content Card (Application Theme) -->
                  <tr>
                    <td style="background-color:#0f172a; border-radius:12px; padding:32px; border:1px solid rgba(255,255,255,0.08); box-shadow:0 10px 25px -5px rgba(0,0,0,0.3);">
                      
                      <!-- Header Section -->
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
                        <tr>
                          <td align="center" style="background:linear-gradient(90deg,#2563eb,#3b82f6); background-color:#2563eb; padding:16px; border-radius:10px;">
                            <h1 style="margin:0; font-family:'Inter', sans-serif; font-size:20px; font-weight:700; color:#ffffff; letter-spacing:-0.5px;">
                              JMJ Management System
                            </h1>
                          </td>
                        </tr>
                      </table>

                      <!-- Body Content -->
                      <h2 style="margin:0 0 16px 0; font-family:'Inter', sans-serif; font-size:18px; font-weight:600; color:#f1f5f9; text-align:center;">
                        Password Reset Request
                      </h2>
                      
                      <p style="margin:0 0 12px 0; font-family:'Inter', sans-serif; font-size:15px; line-height:1.6; color:#cbd5e1;">
                        Hi <strong>${adminName}</strong>,
                      </p>
                      
                      <p style="margin:0 0 24px 0; font-family:'Inter', sans-serif; font-size:15px; line-height:1.6; color:#cbd5e1;">
                        We received a request to reset your password for the JMJ Management Admin account. If you didn't request this, you can safely ignore this email.
                      </p>

                      <!-- Reset Button -->
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
                        <tr>
                          <td align="center">
                            <a href="${resetLink}" target="_blank" rel="noopener"
                               style="display:inline-block; background:linear-gradient(90deg,#2563eb,#3b82f6); background-color:#2563eb; color:#ffffff; padding:12px 32px; border-radius:8px; font-family:'Inter', sans-serif; font-size:15px; font-weight:600; text-decoration:none; box-shadow:0 4px 12px rgba(37,99,235,0.25);">
                              Reset Password
                            </a>
                          </td>
                        </tr>
                      </table>

                      <p style="margin:0 0 12px 0; font-family:'Inter', sans-serif; font-size:13px; color:#94a3b8; text-align:center; line-height:1.4;">
                         This link will expire in <strong>1 hour</strong> for your security.
                      </p>

                      <!-- Fallback Link -->
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid rgba(255,255,255,0.05); padding-top:20px;">
                        <tr>
                          <td>
                            <p style="margin:0; font-family:'Inter', sans-serif; font-size:12px; color:#64748b; text-align:center;">
                              If the button above doesn't work, copy and paste this link into your browser:<br>
                              <a href="${resetLink}" style="color:#3b82f6; text-decoration:none;">${resetLink}</a>
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Footer (Neutral) -->
                  <tr>
                    <td align="center" style="padding-top:24px;">
                      <p style="margin:0; font-family:'Inter', sans-serif; font-size:12px; line-height:1.5; color:#6b7280;">
                        JMJ Bore Wells — Management System<br>
                        &copy; ${new Date().getFullYear()} All rights reserved.
                      </p>
                      <p style="margin:8px 0 0 0; font-family:'Inter', sans-serif; font-size:11px; color:#9ca3af;">
                        This is an automated notification, please do not reply to this email.
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>

        </body>
        </html>
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
    const subject = '⚠️ Security Alert — JMJ Management System';
    const html = `
        <!doctype html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <title>Security Alert — JMJ Management System</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
          </style>
        </head>
        <body style="margin:0; padding:0; background-color:#f3f4f6; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">

          <!-- Neutral Outer Background -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6;">
            <tr>
              <td align="center" style="padding:40px 16px;">

                <!-- Center Container (600px) -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; width:100%; margin:0 auto;">
                  
                  <!-- Main Content Card (Application Theme) -->
                  <tr>
                    <td style="background-color:#0f172a; border-radius:12px; padding:32px; border:1px solid rgba(255,255,255,0.08); box-shadow:0 10px 25px -5px rgba(0,0,0,0.3);">
                      
                      <!-- Header Section (Red Alert Style) -->
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
                        <tr>
                          <td align="center" style="background:linear-gradient(90deg,#dc2626,#ef4444); background-color:#dc2626; padding:16px; border-radius:10px;">
                            <h1 style="margin:0; font-family:'Inter', sans-serif; font-size:20px; font-weight:700; color:#ffffff; letter-spacing:-0.5px;">
                              Security Alert
                            </h1>
                          </td>
                        </tr>
                      </table>

                      <!-- Body Content -->
                      <h2 style="margin:0 0 16px 0; font-family:'Inter', sans-serif; font-size:18px; font-weight:600; color:#ef4444; text-align:center;">
                        Unusual Activity Detected
                      </h2>
                      
                      <p style="margin:0 0 12px 0; font-family:'Inter', sans-serif; font-size:15px; line-height:1.6; color:#cbd5e1;">
                        Hi <strong>${adminName}</strong>,
                      </p>
                      
                      <p style="margin:0 0 16px 0; font-family:'Inter', sans-serif; font-size:15px; line-height:1.6; color:#cbd5e1;">
                        There have been <strong>${attempts} failed login attempts</strong> on your JMJ Management Admin account. As a safety precaution, your account has been temporarily locked.
                      </p>

                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,255,255,0.03); border-radius:8px; margin-bottom:24px;">
                        <tr>
                          <td style="padding:16px;">
                            <p style="margin:0; font-family:'Inter', sans-serif; font-size:14px; color:#cbd5e1; text-align:center;">
                              A password reset email has been sent to you. Please follow those instructions to secure your account.
                            </p>
                          </td>
                        </tr>
                      </table>

                      <p style="margin:0; font-family:'Inter', sans-serif; font-size:14px; font-weight:500; color:#eab308; text-align:center;">
                        ⚠️ If this wasn't you, please investigate or contact IT support immediately.
                      </p>

                    </td>
                  </tr>

                  <!-- Footer (Neutral) -->
                  <tr>
                    <td align="center" style="padding-top:24px;">
                      <p style="margin:0; font-family:'Inter', sans-serif; font-size:12px; line-height:1.5; color:#6b7280;">
                        JMJ Bore Wells — Management System<br>
                        &copy; ${new Date().getFullYear()} All rights reserved.
                      </p>
                      <p style="margin:8px 0 0 0; font-family:'Inter', sans-serif; font-size:11px; color:#9ca3af;">
                        This is an automated security notification.
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>

        </body>
        </html>
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
