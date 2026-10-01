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

function makeTwilioPost(
  accountSid: string,
  authToken: string,
  postData: Record<string, string>
): Promise<{ statusCode: number; data: any }> {
  return new Promise((resolve, reject) => {
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
            resolve({ statusCode: res.statusCode || 500, data: json });
          } catch {
            resolve({ statusCode: res.statusCode || 500, data: { message: responseData } });
          }
        });
      }
    );

    req.on('error', (err) => reject(err));
    req.write(payload);
    req.end();
  });
}

/**
 * Sends a live SMS distress beacon via Twilio REST API
 * (ARCHITECTURE.md §9, PRD §6)
 */
export async function sendTwilioSms(options: SendSmsOptions): Promise<TwilioSendResult> {
  const { to, body } = options;
  const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
  const authToken = process.env.TWILIO_AUTH_TOKEN || '';
  const fromPhone = process.env.TWILIO_FROM_PHONE || process.env.TWILIO_PHONE_NUMBER || '';
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID || '';
  const targetPhone = process.env.TWILIO_TARGET_PHONE || '';
  const trialTemplate = process.env.TWILIO_TEMPLATE_NAME || 'sms_appointment_reminders';
  const isTrialMode = process.env.TWILIO_TRIAL_MODE === 'true';

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

  // On Twilio Trial accounts, unverified dummy numbers will fail. Route dummy seeded numbers to targetPhone if configured
  const effectiveRecipient =
    targetPhone && (to.startsWith('+91222') || to === '112' || !to.startsWith('+'))
      ? targetPhone
      : to;

  const postData: Record<string, string> = {
    To: effectiveRecipient,
    Body: isTrialMode ? trialTemplate : body,
  };

  if (messagingServiceSid) {
    postData.MessagingServiceSid = messagingServiceSid;
  } else {
    postData.From = fromPhone;
  }

  try {
    let result = await makeTwilioPost(accountSid, authToken, postData);

    // If trial account enforces predefined template, retry transparently with trial template
    if (
      result.statusCode >= 400 &&
      typeof result.data?.message === 'string' &&
      result.data.message.includes('predefined SMS templates')
    ) {
      console.log(
        `[Twilio Trial Adapter] Custom body rejected by trial policy. Retrying with approved template: "${trialTemplate}"`
      );
      postData.Body = trialTemplate;
      result = await makeTwilioPost(accountSid, authToken, postData);
    }

    if (result.statusCode >= 200 && result.statusCode < 300) {
      console.log(`[Twilio SMS Success] Message SID: ${result.data.sid} dispatched to ${effectiveRecipient}`);
      return { success: true, messageSid: result.data.sid };
    } else {
      console.warn(
        `[Twilio SMS Error] API rejected with status ${result.statusCode}: ${result.data.message}`
      );
      return {
        success: false,
        error: result.data.message || `Twilio error status ${result.statusCode}`,
      };
    }
  } catch (err: any) {
    console.error('[Twilio SMS Network Error]:', err.message);
    return { success: false, error: err.message };
  }
}
