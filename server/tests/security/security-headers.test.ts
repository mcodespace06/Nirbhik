import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/index';

describe('Security Headers & Defensive HTTP Config (Phase 8, ARCHITECTURE §11)', () => {
  it('enforces Content-Security-Policy, X-Frame-Options, and Referrer-Policy on API responses', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);

    // 1. Clickjacking defense
    expect(res.headers['x-frame-options']).toBe('DENY');

    // 2. MIME sniffing defense
    expect(res.headers['x-content-type-options']).toBe('nosniff');

    // 3. Referrer protection
    expect(res.headers['referrer-policy']).toBe('no-referrer');

    // 4. Content Security Policy
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");

    // 5. Sensor & hardware lockdown
    expect(res.headers['permissions-policy']).toBeDefined();
    expect(res.headers['permissions-policy']).toContain('camera=()');
    expect(res.headers['permissions-policy']).toContain('microphone=()');
    expect(res.headers['permissions-policy']).toContain('geolocation=(self)');
  });
});
