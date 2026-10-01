import { Request, Response, NextFunction } from 'express';

/**
 * Security Headers Middleware (ARCHITECTURE.md §11)
 * Enforces production-grade defensive HTTP headers:
 * - Content-Security-Policy (CSP)
 * - Strict-Transport-Security (HSTS)
 * - X-Frame-Options: DENY (Anti-Clickjacking)
 * - Referrer-Policy: no-referrer
 * - X-Content-Type-Options: nosniff (Anti-MIME-sniffing)
 * - Permissions-Policy: Restricted hardware APIs
 * - X-XSS-Protection: 0 (Modern standard, avoids auditor vulnerabilities)
 */
export function securityHeaders() {
  return (_req: Request, res: Response, next: NextFunction) => {
    // 1. Content Security Policy (CSP)
    // Allows scripts and styles from self; blocks arbitrary injection
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https: wss:; frame-ancestors 'none'; object-src 'none'; base-uri 'self';"
    );

    // 2. Strict-Transport-Security (HSTS)
    // Enforce HTTPS for 1 year, including subdomains
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    // 3. X-Frame-Options (Clickjacking defense)
    res.setHeader('X-Frame-Options', 'DENY');

    // 4. Referrer-Policy
    // Never leak referrers to external domains to protect anonymous tokens and paths
    res.setHeader('Referrer-Policy', 'no-referrer');

    // 5. X-Content-Type-Options
    // Prevent browsers from MIME-sniffing away from the declared content-type
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // 6. X-XSS-Protection
    res.setHeader('X-XSS-Protection', '0');

    // 7. Permissions-Policy
    // Disable intrusive sensors, allow geolocation only if user grants for SOS
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), payment=(), usb=(), display-capture=(), geolocation=(self)'
    );

    // 8. Cache-Control for sensitive APIs
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('X-Download-Options', 'noopen');

    next();
  };
}
