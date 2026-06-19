import { z } from 'zod';

/** The two brand front-ends that share one backend. */
export const BRANDS = ['portal', 'brokerage'] as const;
export type Brand = (typeof BRANDS)[number];

/** RBAC section keys. Add a new key when a new module is introduced. */
export const SECTIONS = [
  'homepage',
  'staff',
  'customers',
  'partners',
  'media',
  'settings',
  // business modules (wired in later milestones)
  'sheets',
  'lands',
  'districts',
  'owners',
  'commissions',
] as const;
export type Section = (typeof SECTIONS)[number];

/** RBAC actions. `MANAGE` implies all the others. */
export const PERM_ACTIONS = ['VIEW', 'CREATE', 'UPDATE', 'DELETE', 'MANAGE'] as const;
export type PermActionKey = (typeof PERM_ACTIONS)[number];

/**
 * Environment schema. Validate where needed with `envSchema.parse(process.env)`.
 * Not parsed at import time so tooling (lint/build) never crashes on missing vars.
 */
export const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(1),
  SMS_PROVIDER: z.enum(['console', 'smsmisr', 'victorylink', 'twilio']).default('console'),
  UPLOAD_DIR: z.string().default('./uploads'),
  SUPERADMIN_EMAIL: z.string().email().optional(),
  SUPERADMIN_PASSWORD: z.string().min(6).optional(),
  PORTAL_URL: z.string().url().optional(),
  BROKERAGE_URL: z.string().url().optional(),
});
export type Env = z.infer<typeof envSchema>;
