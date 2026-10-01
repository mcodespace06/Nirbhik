import { describe, it, expect } from 'vitest';
import { sanitizeText, escapeHtml, sanitizeUploadMetadata } from '../../src/services/complaints/sanitize';
import express, { Request, Response } from 'express';
import request from 'supertest';
import { sanitizeRequestBody } from '../../src/middleware/sanitize';

describe('Input Sanitization & Injection Defense (Phase 8, ARCHITECTURE §11)', () => {
  it('strips dangerous HTML script tags and javascript: pseudoprotocols from strings', () => {
    const malicious = '<script>alert("pwned")</script>Hello <b onmouseover="alert(1)">World</b> javascript:alert(2)';
    const clean = sanitizeText(malicious);

    expect(clean).not.toContain('<script>');
    expect(clean).not.toContain('alert("pwned")');
    expect(clean).not.toContain('onmouseover');
    expect(clean).not.toContain('javascript:');
    expect(clean).toContain('Hello');
    expect(clean).toContain('World');
  });

  it('escapes HTML special characters for safe output encoding', () => {
    const raw = '<div class="alert">Hello & Welcome "User"\'s</div>';
    const escaped = escapeHtml(raw);

    expect(escaped).not.toContain('<div');
    expect(escaped).toContain('&lt;div');
    expect(escaped).toContain('&amp;');
    expect(escaped).toContain('&quot;');
    expect(escaped).toContain('&#039;');
  });

  it('middleware automatically cleans nested request bodies', async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.use(sanitizeRequestBody());

    testApp.post('/test-sanitize', (req: Request, res: Response) => {
      res.json(req.body);
    });

    const res = await request(testApp)
      .post('/test-sanitize')
      .send({
        title: 'Harassment complaint <script>fetch("evil.com")</script>',
        nested: {
          note: 'Please look at <iframe src="phish.com"></iframe> this incident.',
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Harassment complaint');
    expect(res.body.nested.note).toBe('Please look at  this incident.');
  });

  it('sanitizeUploadMetadata rejects unauthorized MIME types and oversized files', () => {
    // 1. Valid image
    const valid = sanitizeUploadMetadata({
      mime: 'image/png',
      size: 1024 * 1024,
      originalName: 'evidence.png',
    });
    expect(valid.valid).toBe(true);
    expect(valid.fileKey).toMatch(/^evidence\/\d+-[a-z0-9]+\.png$/);

    // 2. Disallowed executable
    const invalidMime = sanitizeUploadMetadata({
      mime: 'application/x-msdownload',
      size: 1024,
      originalName: 'virus.exe',
    });
    expect(invalidMime.valid).toBe(false);
    expect(invalidMime.error).toContain('not permitted');

    // 3. Oversized file (6MB)
    const oversized = sanitizeUploadMetadata({
      mime: 'application/pdf',
      size: 6 * 1024 * 1024,
      originalName: 'big_evidence.pdf',
    });
    expect(oversized.valid).toBe(false);
    expect(oversized.error).toContain('exceeds the 5MB upload limit');
  });
});
