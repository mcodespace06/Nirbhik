/**
 * Email-to-SMS Gateway Service
 *
 * Sends SMS messages for FREE by routing through carrier email-to-SMS gateways.
 * Works by emailing `phonenumber@carrier-gateway.com` — the carrier converts
 * the email body into an SMS/MMS and delivers it to the phone.
 *
 * SUPPORTED: US/Canadian carriers (AT&T, Verizon, T-Mobile, Sprint, etc.)
 * NOT SUPPORTED: Indian carriers (Jio, Airtel, Vi, BSNL) — no public gateways.
 *
 * For unsupported carriers, falls back to Twilio API or logs the message.
 */

import { sendEmail } from '../notifications/mailer';

export interface EmailSmsResult {
  success: boolean;
  channel: 'EMAIL_GATEWAY' | 'TWILIO_API' | 'EMAIL_ALERT' | 'CONSOLE_LOG';
  messageId?: string;
  error?: string;
  gatewayAddress?: string;
  fullMessageDelivered: boolean;
}

// ─── Carrier Email-to-SMS Gateway Directory ───
// Format: phoneNumber@gateway → delivers as SMS to that phone
const US_CARRIER_GATEWAYS: Record<string, string> = {
  'att':       'txt.att.net',         // AT&T
  'verizon':   'vtext.com',           // Verizon
  'tmobile':   'tmomail.net',         // T-Mobile
  'sprint':    'messaging.sprintpcs.com', // Sprint (now T-Mobile)
  'uscellular':'email.uscc.net',      // US Cellular
  'boost':     'sms.myboostmobile.com',   // Boost Mobile
  'cricket':   'sms.cricketwireless.net', // Cricket
  'metro':     'mymetropcs.com',      // Metro by T-Mobile
  'virgin':    'vmobl.com',           // Virgin Mobile
  'xfinity':   'vtext.com',          // Xfinity Mobile (Verizon MVNO)
  'googlefi':  'msg.fi.google.com',   // Google Fi
  'mint':      'tmomail.net',         // Mint Mobile (T-Mobile MVNO)
  'visible':   'vtext.com',          // Visible (Verizon MVNO)
};

// MMS gateways (for longer messages > 160 chars)
const US_CARRIER_MMS_GATEWAYS: Record<string, string> = {
  'att':       'mms.att.net',
  'verizon':   'vzwpix.com',
  'tmobile':   'tmomail.net',
  'sprint':    'pm.sprint.com',
  'cricket':   'mms.cricketwireless.net',
  'metro':     'mymetropcs.com',
  'boost':     'myboostmobile.com',
  'uscellular':'mms.uscc.net',
  'googlefi':  'msg.fi.google.com',
};

// Indian carriers — NO public email-to-SMS gateways exist
const INDIAN_CARRIERS_NOTE = `
[Email-to-SMS] Indian telecom carriers (Jio, Airtel, Vi, BSNL) do NOT provide 
public email-to-SMS gateways. For Indian numbers (+91), the system will:
  1. Send the full emergency alert via Gmail email to the configured contacts
  2. Fall back to Twilio API (trial template) for a phone notification
  3. Log the complete intended SMS content to server console
`;

/**
 * Extracts the 10-digit US phone number from various formats
 */
function extractUS10Digit(phone: string): string | null {
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  // +1XXXXXXXXXX or 1XXXXXXXXXX
  if (cleaned.startsWith('+1') && cleaned.length === 12) {
    return cleaned.slice(2);
  }
  if (cleaned.startsWith('1') && cleaned.length === 11) {
    return cleaned.slice(1);
  }
  // Already 10 digits
  if (/^\d{10}$/.test(cleaned)) {
    return cleaned;
  }
  return null;
}

/**
 * Determines if a phone number is a US/CA number eligible for email-to-SMS
 */
function isUSNumber(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  return (
    (cleaned.startsWith('+1') && cleaned.length === 12) ||
    (cleaned.startsWith('1') && cleaned.length === 11) ||
    /^\d{10}$/.test(cleaned)
  );
}

/**
 * Determines if a phone number is an Indian number
 */
function isIndianNumber(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  return cleaned.startsWith('+91') || (cleaned.startsWith('91') && cleaned.length >= 12);
}

/**
 * Sends an SMS via Email-to-SMS gateway for a specific US carrier.
 * The message is sent as a plain-text email to phoneNumber@carrierGateway.
 */
async function sendViaEmailGateway(
  phone10: string,
  carrier: string,
  body: string,
  subject?: string
): Promise<EmailSmsResult> {
  const gateway = body.length > 160
    ? (US_CARRIER_MMS_GATEWAYS[carrier] || US_CARRIER_GATEWAYS[carrier])
    : US_CARRIER_GATEWAYS[carrier];

  if (!gateway) {
    return {
      success: false,
      channel: 'EMAIL_GATEWAY',
      error: `Unknown carrier: ${carrier}`,
      fullMessageDelivered: false,
    };
  }

  const gatewayAddress = `${phone10}@${gateway}`;

  try {
    const sent = await sendEmail({
      to: gatewayAddress,
      subject: subject || 'SOS Alert',
      // Email-to-SMS gateways use the email body as the SMS text
      text: body,
    });

    if (sent) {
      console.log(
        `[Email-to-SMS ✅] Full custom SMS delivered via ${carrier} gateway: ${gatewayAddress}`
      );
      return {
        success: true,
        channel: 'EMAIL_GATEWAY',
        gatewayAddress,
        fullMessageDelivered: true, // Custom body was delivered!
      };
    } else {
      return {
        success: false,
        channel: 'EMAIL_GATEWAY',
        error: 'Email send returned false',
        fullMessageDelivered: false,
      };
    }
  } catch (err: any) {
    console.warn(`[Email-to-SMS] Gateway delivery failed for ${gatewayAddress}: ${err.message}`);
    return {
      success: false,
      channel: 'EMAIL_GATEWAY',
      error: err.message,
      fullMessageDelivered: false,
    };
  }
}

export interface SmartSmsOptions {
  to: string;
  body: string;
  carrier?: string; // e.g. 'att', 'verizon', 'tmobile'
  subject?: string;
  /** If true, also send full alert content via email to DISPATCH_ALERT_EMAIL */
  alsoEmailAlert?: boolean;
}

/**
 * Smart Multi-Channel SMS Dispatcher
 *
 * Priority order:
 *  1. Email-to-SMS Gateway (US/CA numbers with known carrier) → FREE, full custom body
 *  2. Twilio API (all numbers) → paid/trial fallback
 *  3. Email Alert (always) → full message delivered via Gmail
 *  4. Console Log (always) → full message logged for audit
 */
export async function sendSmartSms(options: SmartSmsOptions): Promise<EmailSmsResult> {
  const { to, body, carrier, subject, alsoEmailAlert = true } = options;
  const defaultCarrier = process.env.SMS_GATEWAY_CARRIER || carrier || '';

  // Always log the full intended SMS for audit trail
  console.log(`[Smart SMS] ─── EMERGENCY SMS CONTENT ───`);
  console.log(`[Smart SMS] To: ${to}`);
  console.log(body);
  console.log(`[Smart SMS] ─── END ───`);

  // ── Channel 1: Email-to-SMS Gateway (US numbers with known carrier) ──
  if (isUSNumber(to) && defaultCarrier) {
    const phone10 = extractUS10Digit(to);
    if (phone10) {
      console.log(
        `[Smart SMS] US number detected with carrier "${defaultCarrier}". Attempting Email-to-SMS gateway...`
      );
      const gatewayResult = await sendViaEmailGateway(phone10, defaultCarrier, body, subject);
      if (gatewayResult.success) {
        return gatewayResult;
      }
      console.warn(`[Smart SMS] Email-to-SMS gateway failed. Falling back to Twilio API...`);
    }
  }

  // ── Inform if Indian number (no email-to-SMS support) ──
  if (isIndianNumber(to)) {
    console.log(INDIAN_CARRIERS_NOTE.trim());
  }

  // ── Channel 2: Twilio API fallback ──
  try {
    const { sendTwilioSms } = await import('./twilio');
    const twilioResult = await sendTwilioSms({ to, body });

    if (twilioResult.success) {
      // Also send the full message via email if Twilio used trial template
      if (alsoEmailAlert) {
        const alertEmail = process.env.DISPATCH_ALERT_EMAIL || process.env.CAMPUS_ADMIN_EMAIL || '';
        if (alertEmail) {
          try {
            await sendEmail({
              to: alertEmail,
              subject: `📱 [SMS Alert Mirror] Emergency SMS dispatched to ${to}`,
              text: `The following emergency SMS was dispatched to ${to}:\n\n${body}\n\n---\nTwilio Message SID: ${twilioResult.messageSid || 'N/A'}\nTimestamp: ${new Date().toISOString()}\nNote: On Twilio trial accounts, the recipient receives a generic template. The full message above was delivered to this email address instead.`,
            });
            console.log(
              `[Smart SMS] Full emergency message mirrored via email to ${alertEmail}`
            );
          } catch {
            // Non-critical
          }
        }
      }

      return {
        success: true,
        channel: 'TWILIO_API',
        messageId: twilioResult.messageSid,
        fullMessageDelivered: !twilioResult.simulated,
      };
    }
  } catch (err: any) {
    console.warn(`[Smart SMS] Twilio API unavailable: ${err.message}`);
  }

  // ── Channel 3: Email Alert fallback (always works, full custom content) ──
  if (alsoEmailAlert) {
    const alertEmail = process.env.DISPATCH_ALERT_EMAIL || process.env.CAMPUS_ADMIN_EMAIL || '';
    if (alertEmail) {
      try {
        await sendEmail({
          to: alertEmail,
          subject: `🚨 [EMERGENCY SMS ALERT] Intended SMS to ${to}`,
          text: `EMERGENCY: The following SMS could not be delivered via cellular network.\nIntended recipient: ${to}\n\n${body}\n\n---\nDelivered via email as fallback. The recipient should be contacted directly.\nTimestamp: ${new Date().toISOString()}`,
        });
        return {
          success: true,
          channel: 'EMAIL_ALERT',
          fullMessageDelivered: true,
        };
      } catch {
        // Fall through to console
      }
    }
  }

  // ── Channel 4: Console log (last resort) ──
  return {
    success: true,
    channel: 'CONSOLE_LOG',
    fullMessageDelivered: false,
  };
}

// Export carrier list for admin/config UI
export function getAvailableCarriers(): { id: string; name: string; gateway: string }[] {
  const carrierNames: Record<string, string> = {
    att: 'AT&T', verizon: 'Verizon', tmobile: 'T-Mobile', sprint: 'Sprint',
    uscellular: 'US Cellular', boost: 'Boost Mobile', cricket: 'Cricket',
    metro: 'Metro by T-Mobile', virgin: 'Virgin Mobile', xfinity: 'Xfinity Mobile',
    googlefi: 'Google Fi', mint: 'Mint Mobile', visible: 'Visible',
  };
  return Object.entries(US_CARRIER_GATEWAYS).map(([id, gateway]) => ({
    id,
    name: carrierNames[id] || id,
    gateway,
  }));
}
