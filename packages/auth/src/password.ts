import bcrypt from 'bcryptjs';

/** Minimum password length required across the platform. */
export const MIN_PASSWORD_LENGTH = 6;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
