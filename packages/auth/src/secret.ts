// Single source of truth for the app secret that signs admin-view tokens (adminToken.ts) and
// OTP code hashes (otp.ts). A predictable secret would let an attacker forge admin tokens and
// OTP signatures, so in production a missing/weak secret is fatal — fail closed (F7). In dev we
// permit a fixed fallback for convenience. Resolved lazily so a build without the env var set
// doesn't crash (only real runtime signing/verification hits the guard).
const DEV_FALLBACK = 'dev-insecure-secret-change-me';
const MIN_LENGTH = 16;

let cached: string | null = null;

export function appSecret(): string {
  if (cached) return cached;
  const raw = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || '';
  if (process.env.NODE_ENV === 'production') {
    if (!raw || raw.length < MIN_LENGTH || raw === DEV_FALLBACK) {
      throw new Error(
        'AUTH_SECRET is missing or too weak for production. Set a strong AUTH_SECRET ' +
          '(≥16 chars, e.g. `openssl rand -base64 32`) in the environment before starting.',
      );
    }
    cached = raw;
    return cached;
  }
  cached = raw || DEV_FALLBACK;
  return cached;
}
