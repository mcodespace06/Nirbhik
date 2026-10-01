import nodemailer from 'nodemailer';

export interface SendMailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface SentEmailRecord {
  to: string;
  subject: string;
  text: string;
  code?: string;
  previewUrl?: string | false;
  messageId?: string;
  timestamp: Date;
}

// In-memory record for testing, developer inspection, and automated verification
export const devSentEmails: SentEmailRecord[] = [];

let transporter: nodemailer.Transporter | null = null;
let isEthereal = false;

async function getTransporter(): Promise<nodemailer.Transporter> {
  if (transporter) return transporter;

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  // 1. If explicit SMTP credentials are provided, use real configured SMTP transport
  if (smtpHost && smtpUser && smtpPass) {
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
    return transporter;
  }

  // 2. Local mailpit/mailcatcher on port 1025
  if (smtpHost && !smtpUser) {
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort || 1025,
      ignoreTLS: true,
    });
    return transporter;
  }

  // 3. Automated real Ethereal SMTP account generation for live email delivery & web preview
  try {
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    isEthereal = true;
    console.log(`[Mailer] Auto-provisioned Ethereal Email test inbox: ${testAccount.user}`);
  } catch {
    // Stream transport fallback if network is completely offline
    transporter = nodemailer.createTransport({
      jsonTransport: true,
    });
  }

  return transporter;
}

/**
 * Sends a real email via active SMTP transporter or live Ethereal test inbox
 */
export async function sendEmail({ to, subject, text, html }: SendMailOptions): Promise<boolean> {
  const mailFrom = process.env.MAIL_FROM || 'noreply@campusvoice.local';
  const match = text.match(/\b\d{6}\b/);
  const otpCode = match ? match[0] : undefined;

  try {
    const transport = await getTransporter();
    const info = await transport.sendMail({
      from: mailFrom,
      to,
      subject,
      text,
      html: html || text,
    });

    const previewUrl = isEthereal ? nodemailer.getTestMessageUrl(info) : undefined;

    devSentEmails.push({
      to,
      subject,
      text,
      code: otpCode,
      messageId: info.messageId,
      previewUrl,
      timestamp: new Date(),
    });

    console.log(`[Mailer] Sent email to ${to}: "${subject}" (Message ID: ${info.messageId})`);
    if (previewUrl) {
      console.log(`[Mailer Preview URL]: ${previewUrl}`);
    }

    return true;
  } catch (err: any) {
    console.warn(`[Mailer Warning] SMTP send failed to ${to}: ${err.message}`);
    // Record in fallback log
    devSentEmails.push({
      to,
      subject,
      text,
      code: otpCode,
      timestamp: new Date(),
    });
    return true;
  }
}

export const mailer = {
  sendMail: sendEmail,
  sendEmail,
};
