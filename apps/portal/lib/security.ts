// Data-access posture (F5/F6). One admin-switchable Setting (`security.level`) decides how
// much public data we expose and how hard we throttle. Read via getSecurityLevel(); changed
// from Admin → System → Security with no redeploy. See security.md §3.
import { prisma } from '@noc/db';

export type SecurityLevel = 'LIGHT' | 'MEDIUM' | 'HIGH';
export const SECURITY_LEVELS: readonly SecurityLevel[] = ['LIGHT', 'MEDIUM', 'HIGH'] as const;

const KEY = 'security.level';

export type SecurityGates = {
  level: SecurityLevel;
  /** Break-glass: when true (HIGH only) source scans + maps require a logged-in customer.
   *  At LIGHT/MEDIUM everything is open — we throttle by count instead of gating. */
  loginWall: boolean;
  /** Anonymous rationing events (search + record view) allowed per hour, per browser. */
  anonPerHour: number;
  /** Logged-in rationing events allowed per hour, per account (higher). */
  userPerHour: number;
  /** Generous per-IP ceiling per hour — a safety net that only trips for a scraper looping
   *  with cleared cookies. Set high enough that many real users behind one carrier IP
   *  (CGNAT) never hit it. */
  ipCeilingPerHour: number;
  /** Hard cap on any public list/page size. */
  maxResults: number;
};

// Product decision: keep the data OPEN to everyone; deter bulk-copying by metering how many
// rationing searches / record-views an anonymous *browser* may do per hour (New Obour only).
// LIGHT = generous, MEDIUM (default) = 10/hr anon, HIGH = break-glass (re-enables the login
// wall on scans/maps + tightest quota) for use during a live scraping incident. Logged-in
// users get a much higher budget. See security.md §3.
const GATES: Record<SecurityLevel, Omit<SecurityGates, 'level'>> = {
  LIGHT: { loginWall: false, anonPerHour: 30, userPerHour: 200, ipCeilingPerHour: 300, maxResults: 50 },
  MEDIUM: { loginWall: false, anonPerHour: 10, userPerHour: 100, ipCeilingPerHour: 150, maxResults: 50 },
  HIGH: { loginWall: true, anonPerHour: 5, userPerHour: 60, ipCeilingPerHour: 60, maxResults: 25 },
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
