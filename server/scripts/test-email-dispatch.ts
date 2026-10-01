import dotenv from 'dotenv';
import path from 'path';

// Load server environment
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { sendEmail, devSentEmails } from '../src/services/notifications/mailer';

async function main() {
  console.log('[Test Email] Initializing Gmail SMTP Dispatch Test...');
  console.log('SMTP_HOST:', process.env.SMTP_HOST);
  console.log('SMTP_USER:', process.env.SMTP_USER);
  console.log('MAIL_FROM:', process.env.MAIL_FROM);
  const targetRecipient = process.argv[2] || process.env.CAMPUS_ADMIN_EMAIL || 'smahek911@gmail.com';
  console.log('Target Recipient:', targetRecipient);
  console.log('Sending live email now...');

  const success = await sendEmail({
    to: targetRecipient,
    subject: '🛡️ Nirbhik / CampusVoice - Live Email Dispatch Verified',
    text: `Hello!

This is an automated verification email confirming that the Gmail SMTP service integration for Nirbhik (CampusVoice) is live and functional.

Sender Account: ${process.env.SMTP_USER}
Recipient: ${targetRecipient}
Timestamp: ${new Date().toISOString()}

Security & Safety Alert Dispatch: READY.
`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 20px; border-radius: 8px; color: #ffffff; text-align: center; margin-bottom: 24px;">
          <h1 style="margin: 0; font-size: 24px; letter-spacing: -0.5px;">🛡️ Nirbhik Campus Safety</h1>
          <p style="margin: 6px 0 0; opacity: 0.9; font-size: 14px;">Live Email Dispatch Service Confirmation</p>
        </div>

        <p style="font-size: 16px; color: #1e293b; line-height: 1.5;">
          Hello,
        </p>

        <p style="font-size: 15px; color: #334155; line-height: 1.6;">
          This is an official verification email confirming that the <strong>Gmail SMTP Dispatch System</strong> for <strong>Nirbhik / CampusVoice</strong> is now fully configured, authenticated, and operational.
        </p>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #475569;">
            <tr>
              <td style="padding: 6px 0; font-weight: 600;">Status:</td>
              <td style="padding: 6px 0; color: #16a34a; font-weight: 700;">✅ Active & Authenticated</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: 600;">Sender:</td>
              <td style="padding: 6px 0;">${process.env.SMTP_USER}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: 600;">Recipient:</td>
              <td style="padding: 6px 0;">${targetRecipient}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: 600;">Transport:</td>
              <td style="padding: 6px 0;">Gmail SSL (smtp.gmail.com:465)</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: 600;">Timestamp:</td>
              <td style="padding: 6px 0;">${new Date().toUTCString()}</td>
            </tr>
          </table>
        </div>

        <p style="font-size: 14px; color: #64748b; line-height: 1.5;">
          All automated campus emergency SOS notifications, anonymous grievance tracking confirmations, and anti-ragging escalation dispatches will now be routed directly through this verified channel.
        </p>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />

        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
          Nirbhik Secure Campus Redressal & Safety Architecture • Zero Identity Storage • End-to-End Cryptographic Escrow
        </p>
      </div>
    `,
  });

  const lastRecord = devSentEmails[devSentEmails.length - 1];
  console.log('\n--- RESULT SUMMARY ---');
  console.log('Success:', success);
  if (lastRecord?.messageId) {
    console.log('Message ID:', lastRecord.messageId);
  }
  if (lastRecord?.previewUrl) {
    console.log('Preview URL:', lastRecord.previewUrl);
  }
}

main().catch((err) => {
  console.error('Fatal error during test:', err);
  process.exit(1);
});
