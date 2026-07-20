import { config as loadEnv } from 'dotenv';
import createNextIntlPlugin from 'next-intl/plugin';

// Load the monorepo-root .env so server code (Prisma, Auth.js) sees DATABASE_URL,
// AUTH_SECRET, etc. — Next only auto-loads .env from the app directory.
loadEnv({ path: '../../.env' });

// Behind the reverse proxy, next-auth (running via `next start`) can't infer the
// public origin from the request — it sees `localhost:3001` — so auth redirects
// (e.g. sign-out, provider callbacks) would point at localhost. Pin AUTH_URL to
// this app's public origin. PORTAL_URL is per-environment in .env (prod domain in
// prod, localhost in dev), so this stays correct everywhere; an explicit AUTH_URL
// still wins via `||=`.
process.env.AUTH_URL ||= process.env.PORTAL_URL;

const withNextIntl = createNextIntlPlugin('../../packages/i18n/src/request.ts');

// ── Security headers (F3) ─────────────────────────────────────────────────────
// A pragmatic CSP: it locks down framing, MIME sniffing, base-uri and object/embed,
// and allow-lists exactly the third parties we load (GA4 + Meta Pixel, consent-gated).
// script/style keep 'unsafe-inline' because Next.js injects inline bootstrap without a
// nonce — the actual injection vector (stored XSS) is closed at the source by
// sanitizeRichHtml, so CSP here is defence-in-depth, not the primary control. 'unsafe-eval'
// and upgrade-insecure-requests are prod-only vs dev to avoid breaking Turbopack HMR / http
// localhost. See security.md §4.3.
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
  // ssh2 ships an optional NATIVE addon (sshcrypto.node) that webpack cannot bundle —
  // without this the production build fails outright. It does NOT reproduce on a dev box
  // where npm blocked ssh2's install script, so a green local build proves nothing here.
  serverExternalPackages: ['geoip-lite', 'nodemailer', 'ssh2', 'ssh2-sftp-client'],
  // Lint is run separately (`npm run lint`); keep production builds focused on compile + types.
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  // Konva (via react-konva) references the optional Node-only `canvas` package; we only
  // use its browser build, so stub it out of the bundle.
  webpack: (config) => {
    config.resolve.alias = { ...config.resolve.alias, canvas: false };
    return config;
  },
};

export default withNextIntl(nextConfig);
