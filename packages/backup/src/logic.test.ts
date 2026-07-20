import { describe, expect, it } from 'vitest';
import {
  archiveName,
  contentsLabel,
  isBackupDue,
  kindFor,
  lastScheduledFireTime,
  parseArchiveName,
  planPrune,
  stampUtc,
  type Schedule,
} from './logic';

const S = (over: Partial<Schedule> = {}): Schedule => ({
  frequency: 'DAILY',
  everyN: 1,
  hourUtc: 2,
  weekday: 0,
  dayOfMonth: 1,
  ...over,
});

const utc = (iso: string) => new Date(iso);

describe('lastScheduledFireTime', () => {
  it('OFF never fires — this is what keeps the MANUAL tier button-only', () => {
    expect(lastScheduledFireTime(S({ frequency: 'OFF' }), utc('2026-07-20T12:00:00Z'))).toBeNull();
  });

  it('HOURLY everyN=1 fires on the current hour', () => {
    const f = lastScheduledFireTime(S({ frequency: 'HOURLY' }), utc('2026-07-20T13:45:00Z'));
    expect(f?.toISOString()).toBe('2026-07-20T13:00:00.000Z');
  });

  it('HOURLY everyN=2 is anchored to EVEN utc hours, not to the last run', () => {
    // 13:45 → the last even-hour slot is 12:00 (not 13:00).
    const f = lastScheduledFireTime(S({ frequency: 'HOURLY', everyN: 2 }), utc('2026-07-20T13:45:00Z'));
    expect(f?.toISOString()).toBe('2026-07-20T12:00:00.000Z');
    // and at 14:05 it moves to 14:00 — the series never drifts
    const g = lastScheduledFireTime(S({ frequency: 'HOURLY', everyN: 2 }), utc('2026-07-20T14:05:00Z'));
    expect(g?.toISOString()).toBe('2026-07-20T14:00:00.000Z');
  });

  it('HOURLY everyN=3 lands on hours divisible by 3', () => {
    const f = lastScheduledFireTime(S({ frequency: 'HOURLY', everyN: 3 }), utc('2026-07-20T20:59:00Z'));
    expect(f!.getUTCHours() % 3).toBe(0);
    expect(f!.getUTCHours()).toBe(18);
  });

  it('DAILY fires at hourUtc today once passed, else yesterday', () => {
    expect(lastScheduledFireTime(S(), utc('2026-07-20T03:00:00Z'))?.toISOString())
      .toBe('2026-07-20T02:00:00.000Z');
    expect(lastScheduledFireTime(S(), utc('2026-07-20T01:00:00Z'))?.toISOString())
      .toBe('2026-07-19T02:00:00.000Z');
  });

  it('WEEKLY lands on the requested weekday at hourUtc', () => {
    // Sunday = 0. 2026-07-20 is a Monday, so the last Sunday is the 19th.
    const f = lastScheduledFireTime(S({ frequency: 'WEEKLY', weekday: 0 }), utc('2026-07-20T12:00:00Z'));
    expect(f!.getUTCDay()).toBe(0);
    expect(f?.toISOString()).toBe('2026-07-19T02:00:00.000Z');
  });

  it('MONTHLY lands on dayOfMonth at hourUtc', () => {
    const f = lastScheduledFireTime(S({ frequency: 'MONTHLY', dayOfMonth: 1 }), utc('2026-07-20T12:00:00Z'));
    expect(f?.toISOString()).toBe('2026-07-01T02:00:00.000Z');
  });

  it('everyN < 1 is treated as 1 rather than dividing by zero / looping forever', () => {
    const f = lastScheduledFireTime(S({ frequency: 'HOURLY', everyN: 0 }), utc('2026-07-20T13:45:00Z'));
    expect(f?.toISOString()).toBe('2026-07-20T13:00:00.000Z');
  });

  it('n=1 reproduces the non-everyN behaviour for ALL frequencies', () => {
    const now = utc('2026-07-20T13:45:00Z');
    for (const frequency of ['HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY'] as const) {
      const a = lastScheduledFireTime(S({ frequency, everyN: 1 }), now);
      const b = lastScheduledFireTime(S({ frequency }), now); // everyN defaults to 1
      expect(a?.toISOString()).toBe(b?.toISOString());
    }
  });
});

describe('isBackupDue', () => {
  const now = utc('2026-07-20T03:00:00Z');

  it('is due when it has never run', () => {
    expect(isBackupDue(S(), null, now)).toBe(true);
  });

  it('is NOT due when it already ran after the fire time', () => {
    expect(isBackupDue(S(), utc('2026-07-20T02:30:00Z'), now)).toBe(false);
  });

  it('is due again once a new fire time passes', () => {
    expect(isBackupDue(S(), utc('2026-07-19T02:30:00Z'), now)).toBe(true);
  });

  it('an OFF schedule is never due, even having never run', () => {
    expect(isBackupDue(S({ frequency: 'OFF' }), null, now)).toBe(false);
  });

  it('a missed run fires immediately at the next tick (no drift, no skip)', () => {
    // Server was down all night; the 02:00 slot passed unrun.
    expect(isBackupDue(S(), utc('2026-07-18T02:00:00Z'), utc('2026-07-20T09:00:00Z'))).toBe(true);
  });
});

describe('archive naming', () => {
  it('stamps UTC as YYYYMMDD-HHmmss', () => {
    expect(stampUtc(utc('2026-07-20T09:08:07Z'))).toBe('20260720-090807');
  });

  it('round-trips name → parse', () => {
    const at = utc('2026-07-20T09:08:07Z');
    const name = archiveName('noc', 'full', at);
    expect(name).toBe('noc-backup-full-20260720-090807.tar.gz');
    const p = parseArchiveName('noc', name);
    expect(p?.kind).toBe('full');
    expect(p?.at.toISOString()).toBe(at.toISOString());
  });

  it('rejects another app\'s archives — the shared-storage guard', () => {
    expect(parseArchiveName('noc', 'yeldnin-backup-db-20260720-090807.tar.gz')).toBeNull();
    expect(parseArchiveName('noc', 'veeey-backup-full-20260720-090807.tar.gz')).toBeNull();
  });

  it('rejects malformed / unknown-kind / non-archive names', () => {
    for (const bad of [
      'noc-backup-20260720-090807.tar.gz',        // no kind
      'noc-backup-xxx-20260720-090807.tar.gz',    // unknown kind
      'noc-backup-db-2026072-090807.tar.gz',      // short date
      'noc-backup-db-20260720-090807.zip',        // wrong extension
      'noc-backup-db-20261320-090807.tar.gz',     // month 13
      'notes.txt',
      '',
    ]) {
      expect(parseArchiveName('noc', bad)).toBeNull();
    }
  });

  it('kind + contents label describe what the archive ACTUALLY holds', () => {
    expect(kindFor('DB')).toBe('db');
    expect(kindFor('FULL')).toBe('full');
    expect(contentsLabel('DB')).toBe('db');
    expect(contentsLabel('FULL')).toBe('db,uploads');
  });
});

describe('planPrune — deletes real backups, so these are the safety invariants', () => {
  const n = (kind: 'db' | 'full', stamp: string) => `noc-backup-${kind}-${stamp}.tar.gz`;

  it('keeps the newest N and deletes the rest', () => {
    const names = [
      n('db', '20260720-100000'),
      n('db', '20260720-090000'),
      n('db', '20260720-080000'),
      n('db', '20260720-070000'),
    ];
    expect(planPrune('noc', names, 2).sort()).toEqual(
      [n('db', '20260720-080000'), n('db', '20260720-070000')].sort(),
    );
  });

  it('INVARIANT 1: unparseable / foreign files are NEVER deletion candidates', () => {
    const names = [
      n('db', '20260720-100000'),
      n('db', '20260720-090000'),
      'yeldnin-backup-db-20260101-000000.tar.gz', // another app on shared storage
      'random-note.txt',
      'lost+found',
    ];
    const del = planPrune('noc', names, 1);
    expect(del).toEqual([n('db', '20260720-090000')]);
    expect(del).not.toContain('yeldnin-backup-db-20260101-000000.tar.gz');
    expect(del).not.toContain('random-note.txt');
    expect(del).not.toContain('lost+found');
  });

  it('INVARIANT 2: the most recent archive is never deleted, even at keepLast=0/negative', () => {
    const names = [n('full', '20260720-100000'), n('full', '20260719-100000')];
    expect(planPrune('noc', names, 0)).toEqual([]);   // 0 = keep all
    expect(planPrune('noc', names, -5)).toEqual([]);  // nonsense = keep all
    expect(planPrune('noc', names, 1)).toEqual([n('full', '20260719-100000')]);
  });

  it('sorts by PARSED TIME, not lexically — "db-" would sort before "full-"', () => {
    // Lexically, db-20260101 < full-20260719, so a string sort would call the
    // OLD db archive the newest and delete the recent full one.
    const older = n('full', '20260719-100000');
    const newer = n('db', '20260720-100000');
    expect(planPrune('noc', [older, newer], 1)).toEqual([older]);
  });

  it('is a no-op on an empty or all-foreign folder', () => {
    expect(planPrune('noc', [], 3)).toEqual([]);
    expect(planPrune('noc', ['other-backup-db-20260720-100000.tar.gz'], 1)).toEqual([]);
  });
});
