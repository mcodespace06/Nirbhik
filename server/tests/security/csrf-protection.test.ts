import { describe, it, expect } from 'vitest';
import express, { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { csrfProtection, CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../../src/middleware/csrf';

describe('CSRF Protection & Double-Submit Validation (Phase 8, ARCHITECTURE §11)', () => {
  const testApp = express();
  testApp.use(cookieParser());
  testApp.use(express.json());
  testApp.use(csrfProtection());

  testApp.get('/api/test-safe', (_req: Request, res: Response) => {
    res.json({ safe: true });
  });

  testApp.post('/api/test-mutate', (_req: Request, res: Response) => {
    res.json({ modified: true });
  });

  testApp.post('/api/sos', (_req: Request, res: Response) => {
    res.json({ distress: true });
  });

  it('issues CSRF cookie on safe GET requests', async () => {
    const res = await request(testApp).get('/api/test-safe');
    expect(res.status).toBe(200);
    const cookies = res.headers['set-cookie'] || [];
    const csrfCookie = cookies.find((c: string) => c.includes(CSRF_COOKIE_NAME));
    expect(csrfCookie).toBeDefined();
  });

  it('rejects mutating request without valid CSRF header when test bypass is disabled', async () => {
    // 1. Get token
    const safeRes = await request(testApp).get('/api/test-safe');
    const cookies = safeRes.headers['set-cookie'];

    // 2. Post without CSRF header
    const failRes = await request(testApp)
      .post('/api/test-mutate')
      .set('Cookie', cookies)
      .set('x-test-csrf', 'true') // Enables strict CSRF check
      .send({ data: 123 });

    expect(failRes.status).toBe(403);
    expect(failRes.body.error.code).toBe('CSRF_TOKEN_INVALID');
  });

  it('accepts mutating request when header matches CSRF cookie', async () => {
    const safeRes = await request(testApp).get('/api/test-safe');
    const cookies = safeRes.headers['set-cookie'] as string[];
    const cookieHeader = cookies[0];
    const match = cookieHeader.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`));
    const token = match ? match[1] : '';

    const okRes = await request(testApp)
      .post('/api/test-mutate')
      .set('Cookie', cookies)
      .set(CSRF_HEADER_NAME, token)
      .set('x-test-csrf', 'true')
      .send({ data: 123 });

    expect(okRes.status).toBe(200);
    expect(okRes.body.modified).toBe(true);
  });

  it('exempts emergency SOS triggers from CSRF blocks', async () => {
    const sosRes = await request(testApp)
      .post('/api/sos')
      .set('x-test-csrf', 'true')
      .send({ lat: 19.07, lng: 72.87 });

    expect(sosRes.status).toBe(200);
    expect(sosRes.body.distress).toBe(true);
  });
});
