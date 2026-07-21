// Pure backup logic — NO database, NO filesystem, NO network. Everything here is
// unit-tested (logic.test.ts) because a mistake either skips a backup or DELETES one.
// Portable spec: C:\Claude\YeldnIN\BACKUP.md §5.

export type Frequency = 'OFF' | 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type Contents = 'DB' | 'FULL';
export type ArchiveKind = 'db' | 'full';

export type Schedule = {
  frequency: Frequency;
  /** Every N hours/days/weeks/months. Values < 1 are treated as 1. */
  everyN: number;
  hourUtc: number;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
  /** 1..28 — capped so every month actually has the day. */
  dayOfMonth: number;
};

const HOUR = 3_600_000;
const DAY = 86_400_000;
const WEEK = 7 * DAY;

/** Modulo that is correct for negative operands (JS `%` keeps the sign). */
function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

const clampN = (n: number) => (Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1);
const clampHour = (h: number) => Math.min(23, Math.max(0, Math.floor(h) || 0));
const clampWeekday = (d: number) => Math.min(6, Math.max(0, Math.floor(d) || 0));
const clampDom = (d: number) => Math.min(28, Math.max(1, Math.floor(d) || 1));

/**
 * The most recent moment this schedule should have fired, at or before `now`.
 * Returns null when the schedule is OFF (never due).
 *
 * `everyN` is anchored to FIXED epoch slots, never to the previous run — so
 * "every 2 hours" is always the even UTC hours and a late or missed run can
 * never shift the whole series forward (spec §5.1).
 */
export function lastScheduledFireTime(s: Schedule, now: Date): Date | null {
  const t = now.getTime();
  const n = clampN(s.everyN);

  if (s.frequency === 'OFF') return null;

  if (s.frequency === 'HOURLY') {
    const slot = Math.floor(t / HOUR);
    return new Date((slot - mod(slot, n)) * HOUR);
  }

  const hour = clampHour(s.hourUtc);

  if (s.frequency === 'DAILY') {
    let fire = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour);
    if (fire > t) fire -= DAY;
    // Step back whole days until we land on an anchored slot.
    for (let i = 0; i < 400 && mod(Math.floor(fire / DAY), n) !== 0; i++) fire -= DAY;
    return new Date(fire);
  }

  if (s.frequency === 'WEEKLY') {
    const want = clampWeekday(s.weekday);
    let fire = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour);
    if (fire > t) fire -= DAY;
    // Walk back to the requested weekday.
    for (let i = 0; i < 8 && new Date(fire).getUTCDay() !== want; i++) fire -= DAY;
    for (let i = 0; i < 400 && mod(Math.floor(fire / WEEK), n) !== 0; i++) fire -= WEEK;
    return new Date(fire);
  }

  // MONTHLY
  const dom = clampDom(s.dayOfMonth);
  let y = now.getUTCFullYear();
  let m = now.getUTCMonth();
  let fire = Date.UTC(y, m, dom, hour);
  if (fire > t) {
    m -= 1;
    if (m < 0) { m = 11; y -= 1; }
    fire = Date.UTC(y, m, dom, hour);
  }
  for (let i = 0; i < 400 && mod(y * 12 + m, n) !== 0; i++) {
    m -= 1;
    if (m < 0) { m = 11; y -= 1; }
    fire = Date.UTC(y, m, dom, hour);
  }
  return new Date(fire);
}

/** A tier is due when it has a fire time it has not run for yet. */
export function isBackupDue(s: Schedule, lastRunAt: Date | null | undefined, now: Date): boolean {
  const fire = lastScheduledFireTime(s, now);
  if (fire === null) return false;
  return !lastRunAt || lastRunAt.getTime() < fire.getTime();
}

// ── Archive naming ───────────────────────────────────────────────────────────
// <prefix>-backup-<kind>-YYYYMMDD-HHmmss.tar.gz — UTC. The app prefix is what the
// pruner matches, and is the last line of defence if two apps ever share a folder.

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

export function stampUtc(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`
  );
}

export function archiveName(prefix: string, kind: ArchiveKind, at: Date): string {
  return `${prefix}-backup-${kind}-${stampUtc(at)}.tar.gz`;
}

/**
 * Parse one of OUR archive names. Returns null for anything else — a foreign or
 * unparseable file is never a deletion candidate (invariant 1, §5.3).
 */
export function parseArchiveName(prefix: string, name: string): { kind: ArchiveKind; at: Date } | null {
  const re = new RegExp(`^${escapeRe(prefix)}-backup-(db|full)-(\\d{8})-(\\d{6})\\.tar\\.gz$`);
  const m = re.exec(name);
  if (!m) return null;
  const [, kind, date, time] = m;
  const y = +date!.slice(0, 4), mo = +date!.slice(4, 6), d = +date!.slice(6, 8);
  const hh = +time!.slice(0, 2), mi = +time!.slice(2, 4), ss = +time!.slice(4, 6);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || hh > 23 || mi > 59 || ss > 59) return null;
  const at = new Date(Date.UTC(y, mo - 1, d, hh, mi, ss));
  if (Number.isNaN(at.getTime())) return null;
  // Round-trip the constructed date. `Date.UTC` NORMALIZES impossible calendar days, so a
  // crafted same-prefix name like `…-20240231-…` became 2 March and entered the retention
  // sort with a misleading timestamp — able to displace a legitimate archive from the
  // keep-window. A real archive always round-trips exactly.
  if (
    at.getUTCFullYear() !== y || at.getUTCMonth() !== mo - 1 || at.getUTCDate() !== d ||
    at.getUTCHours() !== hh || at.getUTCMinutes() !== mi || at.getUTCSeconds() !== ss
  ) return null;
  return { kind: kind as ArchiveKind, at };
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Retention ────────────────────────────────────────────────────────────────

/**
 * Which files to delete so only the newest `keepLast` of OURS remain in a folder.
 *
 * Two invariants, both tested, because this deletes real backups:
 *   1. A file that cannot be parsed is NEVER a deletion candidate.
 *   2. The single most recent archive is NEVER deleted, whatever the policy says
 *      (guards a mis-set keepLast, e.g. a stale client posting 0).
 *
 * NOTE: sorting is by PARSED TIMESTAMP, never lexically — the kind segment breaks
 * "lexical order == chronological order" (`db-` sorts before `full-`), so string
 * sorting picks the wrong newest file (spec §4).
 */
export function planPrune(prefix: string, names: string[], keepLast: number): string[] {
  const ours = names
    .map((name) => ({ name, parsed: parseArchiveName(prefix, name) }))
    .filter((x): x is { name: string; parsed: { kind: ArchiveKind; at: Date } } => x.parsed !== null)
    .sort((a, b) => b.parsed.at.getTime() - a.parsed.at.getTime()); // newest first

  if (ours.length === 0) return [];
  if (!Number.isFinite(keepLast) || keepLast <= 0) return []; // 0 = keep all
  const keep = Math.max(1, Math.floor(keepLast)); // invariant 2: always keep >= 1
  return ours.slice(keep).map((x) => x.name);
}

/** What the archive ACTUALLY holds — never let a db-only archive claim uploads. */
export function contentsLabel(contents: Contents): string {
  return contents === 'FULL' ? 'db,uploads' : 'db';
}

export function kindFor(contents: Contents): ArchiveKind {
  return contents === 'FULL' ? 'full' : 'db';
}
