import React, { useState, useEffect } from 'react';
import { Shield, Lock, Mail, User, KeyRound, AlertCircle, ArrowLeft, CheckCircle2, UploadCloud } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface RegisterProps {
  onSuccess?: () => void;
  onNavigateToLogin: () => void;
}

export default function Register({ onSuccess, onNavigateToLogin }: RegisterProps) {
  const { login } = useAuth();

  // Form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [enrollmentNo, setEnrollmentNo] = useState('');
  const [collegeEmail, setCollegeEmail] = useState('');

  // Section 1: Confidential Victim Profile states (Encrypted with AES-256)
  const [legalName, setLegalName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [collegeIdCardNumber, setCollegeIdCardNumber] = useState('');

  // Flow states: 'FORM' | 'ID_CARD' | 'SUCCESS'
  const [step, setStep] = useState<'FORM' | 'ID_CARD' | 'SUCCESS'>('FORM');
  const [userId, setUserId] = useState<string>('');
  const [idCardKey, setIdCardKey] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 10) {
      setError('Password must be at least 10 characters long as per security rules.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          enrollmentNo,
          collegeEmail,
          legalName: legalName || undefined,
          phone: phone || undefined,
          address: address || undefined,
          collegeIdCardNumber: collegeIdCardNumber || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || 'Registration failed.');
      }

      setUserId(data.userId);

      if (data.method === 'SUCCESS') {
        login(data.token, data.user);
        setStep('SUCCESS');
        setTimeout(() => {
          if (onSuccess) onSuccess();
        }, 1500);
      } else {
        setStep('ID_CARD');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };



  const handleIdCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/verify/id-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, idCardFileKey: idCardKey || 'simulated-id-card-photo.png' }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || 'ID submission failed.');
      }

      setStep('SUCCESS');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-2xl border border-slate-200 shadow-xl p-8 relative overflow-y-auto max-h-[90vh]">
      {/* Brand Header */}
      <div className="text-center mb-6">
        <div className="w-12 h-12 rounded-xl bg-sky-700 text-white flex items-center justify-center mx-auto mb-3 shadow-md">
          <Shield className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">
          {step === 'FORM' && 'Create Verified Account'}
          {step === 'ID_CARD' && 'Submit College ID Card'}
          {step === 'SUCCESS' && 'Verification Complete'}
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          {step === 'FORM' && 'Campus-only registration. Anonymity is guaranteed on reports.'}
          {step === 'ID_CARD' && 'Manual admin approval queue fallback'}
          {step === 'SUCCESS' && 'Your account is ready'}
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Step 1: Initial Registration Form */}
      {step === 'FORM' && (
        <form onSubmit={handleRegisterSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Username (Pseudonym)</label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. shadow_student26"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Password <span className="text-slate-400 font-normal">(Min 10 characters)</span>
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-transparent"
              />
            </div>
            {password.length > 0 && password.length < 10 && (
              <span className="text-[11px] text-amber-600 mt-1 block">
                {10 - password.length} more characters required
              </span>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">College ID / Enrollment No.</label>
            <div className="relative">
              <KeyRound className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                required
                value={enrollmentNo}
                onChange={(e) => setEnrollmentNo(e.target.value)}
                placeholder="e.g. EN2026001"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">College Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="email"
                required
                value={collegeEmail}
                onChange={(e) => setCollegeEmail(e.target.value)}
                placeholder="name@college.edu"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-transparent"
              />
            </div>
          </div>

          {/* Section 1: Confidential Victim Profile & Aadhaar Verification */}
          <div className="pt-3 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-sky-800 uppercase tracking-wider flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-sky-700" />
                Confidential Victim Profile (AES-256 Vault)
              </span>
              <span className="text-[10px] text-slate-400">Optional for intake</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Legal Name</label>
              <input
                type="text"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                placeholder="Official Name as per Govt ID"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Permanent / Residential Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Hostel / City Address"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-transparent"
                />
              </div>
            </div>

            {/* College ID Card Number */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-sky-700" />
                College ID Card Number
              </label>
              <input
                type="text"
                value={collegeIdCardNumber}
                onChange={(e) => setCollegeIdCardNumber(e.target.value)}
                placeholder="e.g. 123456789"
                className="w-full px-3 py-1.5 text-sm font-mono tracking-wider rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-600"
              />
              <p className="text-[10px] text-slate-400">
                Encrypted with AES-256. Zero identity storage in public grievances.
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-sky-700 hover:bg-sky-800 text-white font-semibold rounded-xl text-sm transition-colors shadow-sm disabled:opacity-50 mt-2"
          >
            {loading ? 'Verifying with Roster...' : 'Continue to Verification'}
          </button>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={onNavigateToLogin}
              className="text-xs text-sky-700 hover:underline font-medium"
            >
              Already verified? Sign in here
            </button>
          </div>
        </form>
      )}



      {/* Step 3: ID Card Upload Fallback */}
      {step === 'ID_CARD' && (
        <form onSubmit={handleIdCardSubmit} className="space-y-4">
          <div className="p-4 rounded-xl bg-sky-50 border border-sky-100 text-sky-900 text-xs leading-relaxed">
            Your enrollment credentials are not yet reflected in the automatic roster. Upload a clear photograph of your Student or Faculty ID card for manual administrative confirmation.
          </div>

          <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:border-sky-500 transition-colors cursor-pointer bg-slate-50">
            <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <span className="text-xs text-slate-600 block font-medium">Select or drag ID photo</span>
            <span className="text-[11px] text-slate-400 block mt-1">PNG, JPG, or PDF (Max 5MB)</span>
            <input
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              id="id-file-input"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setIdCardKey(`upload-${file.name}`);
              }}
            />
            <label
              htmlFor="id-file-input"
              className="mt-3 inline-block px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              Browse File
            </label>
            {idCardKey && (
              <div className="mt-2 text-xs font-mono text-emerald-700 font-semibold">{idCardKey} selected</div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-sky-700 hover:bg-sky-800 text-white font-semibold rounded-xl text-sm transition-colors shadow-sm disabled:opacity-50"
          >
            {loading ? 'Submitting to Queue...' : 'Submit ID for Verification'}
          </button>
        </form>
      )}

      {/* Step 4: Success Message */}
      {step === 'SUCCESS' && (
        <div className="text-center py-6 space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Welcome to CampusVoice</h3>
          <p className="text-xs text-slate-600">
            Your verification was successful. Redirecting to your dashboard...
          </p>
        </div>
      )}
    </div>
  );
}
