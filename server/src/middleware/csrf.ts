import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export const CSRF_COOKIE_NAME = 'cv_csrf_token';
export const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * Generates a cryptographically secure CSRF token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Express middleware to issue and verify CSRF tokens via Double-Submit Cookie pattern
 * (ARCHITECTURE.md §11)
 */
export function csrfProtection() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Ensure CSRF cookie exists on incoming request; if not, generate one
    let cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
    if (!cookieToken) {
      cookieToken = generateCsrfToken();
      res.cookie(CSRF_COOKIE_NAME, cookieToken, {
        httpOnly: false, // Accessible to client-side JS to read and echo in X-CSRF-Token header
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });
    }

    // Expose generated/current token for routes that return it
    (req as any).csrfToken = cookieToken;

    // Safe read-only HTTP methods do not mutate state
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(req.method)) {
      return next();
    }

    // In test environment, bypass unless specifically requested via x-test-csrf
    if (process.env.NODE_ENV === 'test' && !req.headers['x-test-csrf']) {
      return next();
    }

    // Emergency exemption: SOS triggers should NEVER be blocked by a missing or expired CSRF token
    if (req.path.startsWith('/api/sos') || req.path === '/api/sos') {
      return next();
    }

    // Check request header or body for matching token
    const clientToken =
      (req.headers[CSRF_HEADER_NAME] as string) ||
      (req.headers['x-xsrf-token'] as string) ||
      req.body?._csrf;

    if (!clientToken || !cookieToken || clientToken !== cookieToken) {
      return res.status(403).json({
        error: {
          code: 'CSRF_TOKEN_INVALID',
          message: 'Invalid or missing CSRF token. Please refresh and try again.',
        },
      });
    }

    next();
  };
}
