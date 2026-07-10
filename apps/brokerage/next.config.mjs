import { config as loadEnv } from 'dotenv';
import createNextIntlPlugin from 'next-intl/plugin';

// Load the monorepo-root .env so server code (Prisma, Auth.js) sees DATABASE_URL,
// AUTH_SECRET, etc. — Next only auto-loads .env from the app directory.
loadEnv({ path: '../../.env' });

// Behind the reverse proxy, next-auth (running via `next start`) can't infer the
// public origin from the request — it sees `localhost:3002` — so auth redirects
// (e.g. sign-out, provider callbacks) would point at localhost. Pin AUTH_URL to
// this app's public origin. BROKERAGE_URL is per-environment in .env (prod domain
// in prod, localhost in dev), so this stays correct everywhere; an explicit
// AUTH_URL still wins via `||=`.
process.env.AUTH_URL ||= process.env.BROKERAGE_URL;

const withNextIntl = createNextIntlPlugin('../../packages/i18n/src/request.ts');

// ── Security headers (F3) ─────────────────────────────────────────────────────
// Mirrors the portal policy — see apps/portal/next.config.mjs and security.md §4.3.
const isDev = process.env.NODE_ENV !== 'production';
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "img-src 'self' data: blob: https:",
  "media-src 'self'",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://www.googletagmanager.com https://connect.facebook.net`,
  "connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://connect.facebook.net https://www.facebook.com",
  "frame-src 'self' https://www.facebook.com https://td.doubleclick.net",
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Shared workspace packages are TS source and must be transpiled by Next.
  transpilePackages: ['@noc/ui', '@noc/i18n', '@noc/auth', '@noc/db', '@noc/sms', '@noc/mail', '@noc/config', '@noc/analytics', '@noc/partner-portal'],
  // geoip-lite reads its .dat database via fs at runtime — keep it external so the bundler
  // doesn't break its __dirname-relative paths. nodemailer is a CJS Node lib — keep it external.
  serverExternalPackages: ['geoip-lite', 'nodemailer'],
  // Lint is run separately (`npm run lint`); keep production builds focused on compile + types.
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
