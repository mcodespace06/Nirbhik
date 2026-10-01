import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { sendTwilioSms } from '../src/services/sos/twilio';

async function main() {
  console.log('[Test Twilio] Initializing SMS Dispatch Test...');
  console.log('Account SID:', process.env.TWILIO_ACCOUNT_SID);
  console.log('From Phone:', process.env.TWILIO_FROM_PHONE);
  console.log('Target Phone:', process.env.TWILIO_TARGET_PHONE || '+918591680180');

  const res = await sendTwilioSms({
    to: process.env.TWILIO_TARGET_PHONE || '+918591680180',
    body: '🚨 [CAMPUS SOS TEST] Distress beacon alert: Campus security desk notified.',
  });

  console.log('Twilio Result:', res);
  if (res.success) {
    console.log('✅ Twilio SMS sent successfully! Message SID:', res.messageSid);
  } else {
    console.error('❌ Twilio SMS failed:', res.error);
  }
}

main().catch(console.error);
