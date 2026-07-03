// Data-access posture (F5/F6). One admin-switchable Setting (`security.level`) decides how
// much public data we expose and how hard we throttle. Read via getSecurityLevel(); changed
// from Admin → System → Security with no redeploy. See security.md §3.
import { prisma } from '@noc/db';

export type SecurityLevel = 'LIGHT' | 'MEDIUM' | 'HIGH';
export const SECURITY_LEVELS: readonly SecurityLevel[] = ['LIGHT', 'MEDIUM', 'HIGH'] as const;

const KEY = 'security.level';

export type SecurityGates = {
  level: SecurityLevel;
  /** High-res source scans require a logged-in customer. */
  gateScans: boolean;
  /** District / neighborhood / land maps require a logged-in customer. */
  gateMaps: boolean;
  /** The full rationing sheet detail page requires login. */
  gateDetail: boolean;
  /** Marketplace full listing detail requires login. */
  gateListingDetail: boolean;
  /** Hard cap on any public list/page size. */
  maxResults: number;
  /** Per-IP rate cap for public data endpoints (req/min). */
  ratePerMin: number;
};

// Per the agreed product decision: MEDIUM gates the expensive assets (scans + maps) but keeps
// search and the basic detail page public so residents can still self-serve. HIGH locks the
// detail page + listing detail too and tightens the caps. See security.md §3.
const GATES: Record<SecurityLevel, Omit<SecurityGates, 'level'>> = {
  LIGHT: { gateScans: false, gateMaps: false, gateDetail: false, gateListingDetail: false, maxResults: 50, ratePerMin: 120 },
  MEDIUM: { gateScans: true, gateMaps: true, gateDetail: false, gateListingDetail: false, maxResults: 50, ratePerMin: 60 },
  HIGH: { gateScans: true, gateMaps: true, gateDetail: true, gateListingDetail: true, maxResults: 25, ratePerMin: 30 },
};

export function gatesFor(level: SecurityLevel): SecurityGates {
  return { level, ...GATES[level] };
}

export async function getSecurityLevel(): Promise<SecurityLevel> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: KEY } });
    const v = (row?.value || '').toUpperCase();
    return (SECURITY_LEVELS as readonly string[]).includes(v) ? (v as SecurityLevel) : 'MEDIUM';
  } catch {
    return 'MEDIUM';
  }
}

/** Convenience: the resolved gate set for the current posture. */
export async function getSecurityGates(): Promise<SecurityGates> {
  return gatesFor(await getSecurityLevel());
}

export async function saveSecurityLevel(level: string): Promise<void> {
  const v = (level || '').toUpperCase();
  const clean = (SECURITY_LEVELS as readonly string[]).includes(v) ? v : 'MEDIUM';
  await prisma.setting.upsert({
    where: { key: KEY },
    update: { value: clean },
    create: { key: KEY, value: clean },
  });
}
