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
  'marketplace',
] as const;
export type Section = (typeof SECTIONS)[number];

/** RBAC actions. `MANAGE` implies all the others. */
export const PERM_ACTIONS = ['VIEW', 'CREATE', 'UPDATE', 'DELETE', 'MANAGE'] as const;
export type PermActionKey = (typeof PERM_ACTIONS)[number];

// ── Module 2: land / neighborhood option lists (bilingual where shown to users) ──

/** Common plot-area presets (m²) in New Obour. */
export const AREA_PRESETS = [209, 276, 350, 400, 450, 500, 624, 682, 777] as const;

/** What a neighborhood permits building. */
export const BUILDING_TYPES = [
  { key: 'home', ar: 'منزل', en: 'Home' },
  { key: 'building', ar: 'عمارة', en: 'Building' },
  { key: 'villa', ar: 'فيلا', en: 'Villa' },
] as const;

/** Main roads/axes a neighborhood can sit on. */
export const MAIN_ROADS = [
  { key: 'R2', ar: 'R2', en: 'R2' },
  { key: 'R3', ar: 'R3', en: 'R3' },
  { key: 'R4', ar: 'R4', en: 'R4' },
  { key: 'R5', ar: 'R5', en: 'R5' },
  { key: 'R6', ar: 'R6', en: 'R6' },
  { key: 'ring', ar: 'الطريق الدائري الإقليمي', en: 'Regional Ring Road' },
  { key: 'middle_ring', ar: 'الطريق الأوسطي', en: 'Middle Ring Road' },
  { key: 'ismailia', ar: 'طريق الإسماعيلية', en: 'Ismailia Road' },
  { key: 'belbees', ar: 'طريق بلبيس', en: 'Belbees Road' },
] as const;

/** Coarse locations for rationing-sheet ("تقنين") lands. */
export const SHEET_LOCATIONS = [
  { key: 'qadessia', ar: 'القادسية', en: 'Qadessia' },
  { key: 'amal', ar: 'الأمل', en: 'Amal' },
  { key: 'talaee', ar: 'الطلائع', en: 'Eltalaee' },
] as const;

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
