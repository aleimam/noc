/**
 * Analytics daily rollup — aggregates raw visit data into one AnalyticsDaily row per
 * (site, day). Runs nightly (before the retention prune) so long-term trends survive once
 * the raw tables are pruned to ~90 days.
 *
 * Usage:
 *   tsx ops/analytics-rollup.ts        # roll up the last 2 days (yesterday + today so far)
 *   tsx ops/analytics-rollup.ts 400    # backfill: roll up the last 400 days
 *
 * Bots (device='bot') are excluded, matching the live dashboard. Days with no activity are
 * skipped (no empty rows). Idempotent — re-running overwrites the same (site, day) row.
 */
import { prisma } from '@noc/db';

const SITES = ['newobour', 'alsawarey'] as const;
const DAY_MS = 86_400_000;

async function rollupDay(site: string, dayStart: Date) {
  const gte = dayStart;
  const lt = new Date(dayStart.getTime() + DAY_MS);
  const notBot = { device: { not: 'bot' } };

  const [sessions, newVisitors, pageviews, events] = await Promise.all([
    prisma.visitSession.findMany({ where: { site, startedAt: { gte, lt }, ...notBot }, select: { visitorId: true, durationSec: true, isBounce: true } }),
    prisma.visitor.count({ where: { site, firstSeen: { gte, lt } } }),
    prisma.pageView.count({ where: { site, ts: { gte, lt }, session: notBot } }),
    prisma.analyticsEvent.count({ where: { site, ts: { gte, lt }, session: notBot } }),
  ]);

  const sessionCount = sessions.length;
  if (sessionCount === 0 && pageviews === 0 && events === 0 && newVisitors === 0) return null; // nothing happened

  const visitors = new Set(sessions.map((s) => s.visitorId)).size;
  const avgDuration = sessionCount ? Math.round(sessions.reduce((a, s) => a + s.durationSec, 0) / sessionCount) : 0;
  const bounces = sessions.filter((s) => s.isBounce).length;
  const data = { visitors, newVisitors, sessions: sessionCount, pageviews, events, avgDuration, bounces };

  await prisma.analyticsDaily.upsert({
    where: { site_day: { site, day: dayStart } },
    create: { site, day: dayStart, ...data },
    update: data,
  });
  return { site, day: dayStart.toISOString().slice(0, 10), ...data };
}

async function main() {
  const days = Math.max(1, Number(process.argv[2]) || 2);
  const now = new Date();
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  let written = 0;
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = new Date(todayUTC - i * DAY_MS);
    for (const site of SITES) {
      const r = await rollupDay(site, dayStart);
      if (r) written++;
    }
  }
  console.log(`[${new Date().toISOString()}] analytics rollup: ${written} site-day rows written over ${days} day(s)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('analytics rollup failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
