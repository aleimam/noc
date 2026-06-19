import { config as loadEnv } from 'dotenv';
import createNextIntlPlugin from 'next-intl/plugin';

// Load the monorepo-root .env so server code (Prisma, Auth.js) sees DATABASE_URL,
// AUTH_SECRET, etc. — Next only auto-loads .env from the app directory.
loadEnv({ path: '../../.env' });

const withNextIntl = createNextIntlPlugin('../../packages/i18n/src/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Shared workspace packages are TS source and must be transpiled by Next.
  transpilePackages: ['@noc/ui', '@noc/i18n', '@noc/auth', '@noc/db', '@noc/sms', '@noc/config'],
  // Lint is run separately (`npm run lint`); keep production builds focused on compile + types.
  eslint: { ignoreDuringBuilds: true },
};

export default withNextIntl(nextConfig);
