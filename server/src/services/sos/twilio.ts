import https from 'https';
import querystring from 'querystring';

export interface SendSmsOptions {
  to: string;
  body: string;
}

export interface TwilioSendResult {
  success: boolean;
  messageSid?: string;
  error?: string;
  simulated?: boolean;
}

const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
const authToken = process.env.TWILIO_AUTH_TOKEN || '';
const fromPhone = process.env.TWILIO_FROM_PHONE || process.env.TWILIO_PHONE_NUMBER || '';
const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID || '';

/**
 * Sends a live SMS distress beacon via Twilio REST API
 * (ARCHITECTURE.md §9, PRD §6)
 */
export async function sendTwilioSms(options: SendSmsOptions): Promise<TwilioSendResult> {
  const { to, body } = options;

  if (!accountSid || !authToken) {
    console.warn('[Twilio SMS] Missing Twilio Account SID or Auth Token. Skipping live SMS.');
    return { success: false, error: 'Missing Twilio credentials' };
  }

  // If no fromPhone or messagingServiceSid is configured, inform in logs
  if (!fromPhone && !messagingServiceSid) {
    console.warn(
      `[Twilio SMS Notice] Account ${accountSid} is active, but TWILIO_FROM_PHONE is not configured in .env. To receive physical cellular SMS, acquire a phone number in your Twilio Console (https://console.twilio.com) and add it to .env.`
    );
    console.log(`[Twilio SMS Fallback Log] Target: ${to} | Content: ${body}`);
    return {
      success: true,
      simulated: true,
      error: 'No Twilio Sender Number configured. Message logged to console.',
    };
  }

  return new Promise((resolve) => {
    const postData: Record<string, string> = {
      To: to,
      Body: body,
    };

    if (messagingServiceSid) {
      postData.MessagingServiceSid = messagingServiceSid;
    } else {
      postData.From = fromPhone;
    }

    const payload = querystring.stringify(postData);
    const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const req = https.request(
      {
        hostname: 'api.twilio.com',
        path: `/2010-04-01/Accounts/${accountSid}/Messages.json`,
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let responseData = '';
        res.on('data', (chunk) => (responseData += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(responseData);
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              console.log(`[Twilio SMS Success] Message SID: ${json.sid} dispatched to ${to}`);
              resolve({ success: true, messageSid: json.sid });
            } else {
              console.warn(
                `[Twilio SMS Error] API rejected with status ${res.statusCode}: ${json.message || responseData}`
              );
              resolve({
                success: false,
                error: json.message || `Twilio error status ${res.statusCode}`,
              });
            }
          } catch (e: any) {
            console.error('[Twilio SMS Parse Error]:', e.message);
            resolve({ success: false, error: e.message });
          }
        });
      }
    );

    req.on('error', (err) => {
      console.error('[Twilio SMS Network Error]:', err.message);
      resolve({ success: false, error: err.message });
    });

    req.write(payload);
    req.end();
  });
}
