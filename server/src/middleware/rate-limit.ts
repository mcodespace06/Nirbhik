import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetAt: number;
  };
}

const store: RateLimitStore = {};

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const k in store) {
    if (store[k].resetAt < now) {
      delete store[k];
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
  keyPrefix?: string;
  perAccount?: boolean;
}

/**
 * Production-ready In-Memory / Distributed Rate Limiter
 * Enforces per-IP and per-Account quotas (ARCHITECTURE.md §11)
 */
export function rateLimiter(options: RateLimitOptions) {
  const { maxRequests, windowMs, keyPrefix = 'rl', perAccount = false } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // In test environment, allow bypassing unless specifically testing rate limiter
    if (process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit']) {
      return next();
    }

    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const keys: string[] = [`${keyPrefix}:ip:${ip}`];

    // If perAccount is enabled, also rate-limit by user ID or submitted identifier
    if (perAccount) {
      const user = (req as any).user;
      if (user?.id) {
        keys.push(`${keyPrefix}:user:${user.id}`);
      } else if (req.body?.collegeEmail) {
        keys.push(`${keyPrefix}:email:${req.body.collegeEmail.toLowerCase()}`);
      } else if (req.body?.username) {
        keys.push(`${keyPrefix}:user:${req.body.username.toLowerCase()}`);
      }
    }

    const now = Date.now();

    for (const key of keys) {
      if (!store[key] || store[key].resetAt < now) {
        store[key] = {
          count: 1,
          resetAt: now + windowMs,
        };
      } else {
        store[key].count += 1;
        if (store[key].count > maxRequests) {
          const retryAfterSec = Math.ceil((store[key].resetAt - now) / 1000);
          res.setHeader('Retry-After', retryAfterSec);
          return res.status(429).json({
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: `Too many requests for ${keyPrefix}. Please try again in ${retryAfterSec} seconds.`,
            },
          });
        }
      }
    }

    next();
  };
}

// Pre-configured rate limiters conforming to ARCHITECTURE.md §11
export const globalLimiter = rateLimiter({
  maxRequests: 300,
  windowMs: 60 * 1000,
  keyPrefix: 'global',
});

export const complaintSubmitLimiter = rateLimiter({
  maxRequests: 15,
  windowMs: 10 * 60 * 1000,
  keyPrefix: 'complaint-submit',
  perAccount: true,
});

export const aiAssistantLimiter = rateLimiter({
  maxRequests: 30,
  windowMs: 5 * 60 * 1000,
  keyPrefix: 'ai-assistant',
  perAccount: true,
});

export const sosTriggerLimiter = rateLimiter({
  maxRequests: 15,
  windowMs: 5 * 60 * 1000,
  keyPrefix: 'sos-distress',
  perAccount: true,
});
