import crypto from 'crypto';
import { generateOTP, hashOTP, verifyOTPHash, getOTPExpiry } from './otp';
import { encryptField, decryptField } from '../vault/crypto';
import { sendEmail } from '../notifications/mailer';
import { sendSmartSms } from '../sos/email-sms-gateway';

export interface AadhaarOtpSession {
  aadhaarHash: string;
  aadhaarLast4: string;
  phoneOrEmail: string;
  otpHash: string;
  expiresAt: Date;
  verified: boolean;
  verificationToken?: string;
}

// Ephemeral in-memory store for OTP verification sessions
const aadhaarSessions = new Map<string, AadhaarOtpSession>();

// In-memory encrypted profile store for verified victim details
// Keyed by user id or pseudonym hash, all contents encrypted with AES-256-GCM
export interface EncryptedVictimProfile {
  encLegalName: string;
  encPhone: string;
  encEmail: string;
  encAddress: string;
  aadhaarLast4: string;
  aadhaarVerified: boolean;
  verifiedAt: string;
}

const victimProfileVault = new Map<string, EncryptedVictimProfile>();

/**
 * Validates 12-digit Aadhaar number format
 */
export function isValidAadhaarFormat(aadhaarNumber: string): boolean {
  const clean = aadhaarNumber.replace(/[\s\-]/g, '');
  return /^\d{12}$/.test(clean);
}

/**
 * Initiates UIDAI OTP verification simulation
 */
export async function sendAadhaarOtp(aadhaarNumber: string, phoneOrEmail: string): Promise<{
  sessionId: string;
  maskedRecipient: string;
  devOtp?: string;
}> {
  const cleanAadhaar = aadhaarNumber.replace(/[\s\-]/g, '');
  if (!isValidAadhaarFormat(cleanAadhaar)) {
    throw new Error('Invalid Aadhaar number. Must be exactly 12 numeric digits.');
  }

  const aadhaarLast4 = cleanAadhaar.slice(-4);
  const aadhaarHash = crypto.createHash('sha256').update(cleanAadhaar).digest('hex');
  const sessionId = crypto.randomBytes(16).toString('hex');

  const otp = generateOTP();
  const otpHash = hashOTP(otp);
  const expiresAt = getOTPExpiry(10); // 10 minutes

  aadhaarSessions.set(sessionId, {
    aadhaarHash,
    aadhaarLast4,
    phoneOrEmail,
    otpHash,
    expiresAt,
    verified: false,
  });

  const isEmail = phoneOrEmail.includes('@');
  if (isEmail) {
    await sendEmail({
      to: phoneOrEmail,
      subject: 'Aadhaar Identity Verification Code (UIDAI Simulation)',
      text: `Your Aadhaar verification OTP is: ${otp}. It expires in 10 minutes. For Aadhaar ending in ${aadhaarLast4}.`,
    });
  } else {
    await sendSmartSms({
      to: phoneOrEmail,
      body: `UIDAI OTP: ${otp} is your verification code for Aadhaar ending in ${aadhaarLast4}. Valid for 10 mins.`,
    });
  }

  // Return masked recipient
  let masked = phoneOrEmail;
  if (isEmail) {
    const parts = phoneOrEmail.split('@');
    masked = `${parts[0].slice(0, 2)}***@${parts[1]}`;
  } else {
    masked = `+91 ******${phoneOrEmail.slice(-4)}`;
  }

  return {
    sessionId,
    maskedRecipient: masked,
    ...(process.env.NODE_ENV !== 'production' && { devOtp: otp }),
  };
}

/**
 * Verifies Aadhaar OTP and generates signed verification token
 */
export function verifyAadhaarOtp(sessionId: string, otp: string): {
  success: boolean;
  aadhaarLast4: string;
  verificationToken: string;
} {
  const session = aadhaarSessions.get(sessionId);
  if (!session) {
    throw new Error('Aadhaar verification session expired or not found.');
  }

  if (new Date() > session.expiresAt) {
    aadhaarSessions.delete(sessionId);
    throw new Error('Aadhaar OTP has expired. Please request a new code.');
  }

  if (!verifyOTPHash(otp, session.otpHash)) {
    throw new Error('Incorrect Aadhaar OTP. Please try again.');
  }

  const verificationToken = crypto.randomBytes(24).toString('hex');
  session.verified = true;
  session.verificationToken = verificationToken;

  return {
    success: true,
    aadhaarLast4: session.aadhaarLast4,
    verificationToken,
  };
}

/**
 * Encrypts and securely vaults the full victim profile details
 */
export function vaultVictimProfile(
  identifier: string,
  profile: {
    legalName: string;
    phone: string;
    email: string;
    address: string;
    aadhaarNumber?: string;
    verificationToken?: string;
  }
): EncryptedVictimProfile {
  let aadhaarLast4 = 'N/A';
  let aadhaarVerified = false;

  if (profile.aadhaarNumber) {
    const clean = profile.aadhaarNumber.replace(/[\s\-]/g, '');
    aadhaarLast4 = clean.slice(-4);
  }

  // Validate verification token if provided
  if (profile.verificationToken) {
    for (const [, session] of aadhaarSessions.entries()) {
      if (session.verificationToken === profile.verificationToken && session.verified) {
        aadhaarVerified = true;
        aadhaarLast4 = session.aadhaarLast4;
        break;
      }
    }
  }

  const encrypted: EncryptedVictimProfile = {
    encLegalName: encryptField(profile.legalName),
    encPhone: encryptField(profile.phone),
    encEmail: encryptField(profile.email),
    encAddress: encryptField(profile.address),
    aadhaarLast4,
    aadhaarVerified,
    verifiedAt: new Date().toISOString(),
  };

  victimProfileVault.set(identifier, encrypted);
  return encrypted;
}

/**
 * Decrypts a victim profile for authorized statutory review (strictly break-glass or officer with signed approval)
 */
export function getDecryptedVictimProfile(identifier: string): {
  legalName: string;
  phone: string;
  email: string;
  address: string;
  aadhaarLast4: string;
  aadhaarVerified: boolean;
  verifiedAt: string;
} | null {
  const enc = victimProfileVault.get(identifier);
  if (!enc) return null;

  try {
    return {
      legalName: decryptField(enc.encLegalName),
      phone: decryptField(enc.encPhone),
      email: decryptField(enc.encEmail),
      address: decryptField(enc.encAddress),
      aadhaarLast4: enc.aadhaarLast4,
      aadhaarVerified: enc.aadhaarVerified,
      verifiedAt: enc.verifiedAt,
    };
  } catch {
    return null;
  }
}
