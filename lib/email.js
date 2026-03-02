/**
 * Email utility for Cortex LMS
 * Uses Nodemailer with SMTP (Zoho or any SMTP provider).
 *
 * Required env vars (add to .env once IT sets up noreply@iohealth.com):
 *   SMTP_HOST      e.g. smtp.zoho.com
 *   SMTP_PORT      e.g. 587
 *   SMTP_SECURE    "false" for STARTTLS (port 587), "true" for SSL (port 465)
 *   SMTP_USER      e.g. noreply@iohealth.com
 *   SMTP_PASS      App-specific password from Zoho
 *   SMTP_FROM      e.g. "Cortex LMS <noreply@iohealth.com>"
 *   SMTP_REPLY_TO  e.g. no-reply@iohealth.com  (optional, disables replies)
 *   APP_URL        e.g. https://lms.iohealth.com
 */

import nodemailer from 'nodemailer';

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true';

  if (!host || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    // SMTP not configured yet — return null so callers can skip gracefully
    return null;
  }

  _transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return _transporter;
}

/**
 * Sends a welcome/invitation email to a newly created user.
 *
 * @param {string} to           - recipient email
 * @param {string} displayName  - recipient's display name
 * @param {string} password     - plain-text password (sent once on account creation)
 * @param {string} [staffId]    - auto-generated staff ID
 * @returns {Promise<{ sent: boolean, error?: string }>}
 */
export async function sendInvitationEmail(to, displayName, password, staffId) {
  const transporter = getTransporter();

  if (!transporter) {
    // Email not configured — skip silently (no crash)
    return { sent: false, error: 'SMTP not configured' };
  }

  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const fromName = process.env.SMTP_FROM || `Cortex LMS <${process.env.SMTP_USER}>`;
  const replyTo = process.env.SMTP_REPLY_TO || process.env.SMTP_USER;
  const name = displayName || to.split('@')[0];

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to Cortex LMS</title>
</head>
<body style="margin:0;padding:0;background:#0f1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f1117;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#1a1d27;border-radius:12px;overflow:hidden;border:1px solid #2a2d3e;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 40px;">
            <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">
              Cortex <span style="opacity:0.8;">LMS</span>
            </h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">
              Learning Management System
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <h2 style="margin:0 0 8px;color:#e2e8f0;font-size:20px;font-weight:600;">
              Welcome, ${name}!
            </h2>
            <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.6;">
              Your Cortex LMS account has been created. Here are your login credentials:
            </p>

            <!-- Credentials box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f1117;border-radius:8px;border:1px solid #2a2d3e;margin-bottom:24px;">
              <tr>
                <td style="padding:20px 24px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:6px 0;">
                        <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Username (Email)</span><br/>
                        <span style="color:#e2e8f0;font-size:15px;font-weight:500;font-family:monospace;">${to}</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:10px 0 6px;border-top:1px solid #2a2d3e;">
                        <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Temporary Password</span><br/>
                        <span style="color:#e2e8f0;font-size:15px;font-weight:500;font-family:monospace;">${password}</span>
                      </td>
                    </tr>
                    ${staffId ? `
                    <tr>
                      <td style="padding:10px 0 6px;border-top:1px solid #2a2d3e;">
                        <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Staff ID</span><br/>
                        <span style="color:#e2e8f0;font-size:15px;font-weight:500;font-family:monospace;">${staffId}</span>
                      </td>
                    </tr>` : ''}
                  </table>
                </td>
              </tr>
            </table>

            <!-- CTA -->
            <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="background:#6366f1;border-radius:8px;">
                  <a href="${appUrl}/login" style="display:inline-block;padding:12px 28px;color:#fff;font-size:15px;font-weight:600;text-decoration:none;">
                    Log In to Cortex LMS →
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;">
              For security, please change your password after your first login.<br/>
              If you did not expect this email, please contact your administrator.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 40px;border-top:1px solid #2a2d3e;">
            <p style="margin:0;color:#475569;font-size:12px;">
              This is an automated message from Cortex LMS. Please do not reply to this email.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
  `.trim();

  try {
    await transporter.sendMail({
      from: fromName,
      replyTo,
      to,
      subject: 'Your Cortex LMS Account — Login Credentials',
      html,
    });
    return { sent: true };
  } catch (err) {
    console.error('[email] sendInvitationEmail failed:', err.message);
    return { sent: false, error: err.message };
  }
}
