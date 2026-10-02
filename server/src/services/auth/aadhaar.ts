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

export interface EncryptedVictimProfile {
  encLegalName: string;
  encPhone: string;
  encEmail: string;
  encAddress: string;
  encCollegeIdCardNumber: string;
  verifiedAt: string;
}

const victimProfileVault = new Map<string, EncryptedVictimProfile>();

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
    collegeIdCardNumber?: string;
  }
): EncryptedVictimProfile {
  const encrypted: EncryptedVictimProfile = {
    encLegalName: encryptField(profile.legalName),
    encPhone: encryptField(profile.phone),
    encEmail: encryptField(profile.email),
    encAddress: encryptField(profile.address),
    encCollegeIdCardNumber: encryptField(profile.collegeIdCardNumber || 'N/A'),
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
  collegeIdCardNumber: string;
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
      collegeIdCardNumber: decryptField(enc.encCollegeIdCardNumber),
      verifiedAt: enc.verifiedAt,
    };
  } catch {
    return null;
  }
}
