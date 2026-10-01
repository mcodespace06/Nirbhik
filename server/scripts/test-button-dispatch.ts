import dotenv from 'dotenv';
import path from 'path';

// Load server environment
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { dispatchSosAlert } from '../src/services/sos/dispatch';
import { devSentEmails } from '../src/services/notifications/mailer';

async function main() {
  console.log('=====================================================');
  console.log('🚨 TESTING BUTTON TRIGGER DISPATCH (SMS + EMAIL)');
  console.log('=====================================================');
  console.log('Campus Security Desk Email:', process.env.SECURITY_DESK_EMAIL || 'smahek911@gmail.com');
  console.log('Campus Security Desk Phone:', process.env.SECURITY_DESK_PHONE || '+918591680180');
  console.log('Twilio From Phone:', process.env.TWILIO_FROM_PHONE);
  console.log('Simulating User SOS Emergency Button Click at Campus...');

  const mockSosId = 'sos-btn-test-' + Date.now();
  const testLat = 19.0760;
  const testLng = 72.8777;
  const mockUser = {
    username: 'Mahek S.',
    email: 'smahek911@gmail.com',
    phone: '+918591680180',
    role: 'STUDENT',
  };

  const dispatchResult = await dispatchSosAlert(
    mockSosId,
    testLat,
    testLng,
    10,
    mockUser
  );

  console.log('\n--- DISPATCH SUMMARY ---');
  console.log('Dispatched Recipients Count:', dispatchResult.dispatchedTo.length);
  for (const recipient of dispatchResult.dispatchedTo) {
    console.log(`- [${recipient.type}] ${recipient.name} | Email: ${recipient.email} | Phone: ${recipient.phone}`);
  }

  const latestEmails = devSentEmails.slice(-2);
  console.log('\n--- EMAIL DISPATCH VERIFICATION ---');
  for (const record of latestEmails) {
    console.log(`📧 Sent to: ${record.to} | Subject: "${record.subject}" | Message ID: ${record.messageId || 'N/A'}`);
  }

  console.log('\n✅ EMERGENCY BUTTON DISPATCH TEST COMPLETED SUCCESSFULLY.');
}

main().catch((err) => {
  console.error('Fatal dispatch error:', err);
  process.exit(1);
});
