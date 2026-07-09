import { prisma } from '@noc/db';

// First-party analytics queries for the admin dashboard. Bots (device='bot') are excluded
// everywhere. At current volume these compute in-process; daily rollups come in a later phase.

export type SiteFilter = 'all' | 'newobour' | 'alsawarey';
export type Range = { from: Date; to: Date; site: SiteFilter; days: number };

const DAY = 86400000;

/** Parse the dashboard filters from the URL search params. */
export function parseRange(sp: Record<string, string | string[] | undefined>): Range {
  const site: SiteFilter = sp.site === 'newobour' || sp.site === 'alsawarey' ? sp.site : 'all';
  const days = [7, 14, 30, 90, 365].includes(Number(sp.days)) ? Number(sp.days) : 30;
  const to = new Date();
  const from = new Date(to.getTime() - days * DAY);
  return { from, to, site, days };
}

const siteWhere = (site: SiteFilter) => (site === 'all' ? {} : { site });
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

function topBy<T>(rows: T[], key: (t: T) => string | null, n = 8) {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = key(r) || '—';
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([label, count]) => ({ label, count }));
}

export async function getOverview({ from, to, site }: Range) {
  const sWhere = { startedAt: { gte: from, lte: to }, device: { not: 'bot' }, ...siteWhere(site) };
  const pWhere = { ts: { gte: from, lte: to }, session: { device: { not: 'bot' } }, ...siteWhere(site) };

  const [sessions, pageviews, newVisitors] = await Promise.all([
    prisma.visitSession.findMany({
      where: sWhere,
      take: 50000,
      select: { startedAt: true, durationSec: true, isBounce: true, device: true, os: true, browser: true, country: true, region: true, source: true, visitorId: true, userId: true, language: true },
    }),
    prisma.pageView.findMany({ where: pWhere, take: 100000, select: { path: true, ts: true, durationSec: true, scrollPct: true } }),
    prisma.visitor.count({ where: { firstSeen: { gte: from, lte: to }, ...siteWhere(site) } }),
  ]);

  const sessionCount = sessions.length;
  const pvCount = pageviews.length;
  const visitors = new Set(sessions.map((s) => s.visitorId)).size;
  const avgDuration = sessionCount ? Math.round(sessions.reduce((a, s) => a + s.durationSec, 0) / sessionCount) : 0;
  const bounceRate = sessionCount ? Math.round((sessions.filter((s) => s.isBounce).length / sessionCount) * 100) : 0;
  const loggedIn = sessions.filter((s) => s.userId).length;

  const days: string[] = [];
  for (let t = from.getTime(); t <= to.getTime(); t += DAY) days.push(dayKey(new Date(t)));
  const pv = new Map<string, number>(days.map((d) => [d, 0]));
  const se = new Map<string, number>(days.map((d) => [d, 0]));
  for (const p of pageviews) pv.set(dayKey(p.ts), (pv.get(dayKey(p.ts)) ?? 0) + 1);
  for (const s of sessions) se.set(dayKey(s.startedAt), (se.get(dayKey(s.startedAt)) ?? 0) + 1);
  const series = days.map((d) => ({ day: d, pageviews: pv.get(d) ?? 0, sessions: se.get(d) ?? 0 }));

  const pageMap = new Map<string, { views: number; dur: number; durN: number; scroll: number; scrollN: number }>();
  for (const p of pageviews) {
    const e = pageMap.get(p.path) ?? { views: 0, dur: 0, durN: 0, scroll: 0, scrollN: 0 };
    e.views++;
    if (p.durationSec != null) { e.dur += p.durationSec; e.durN++; }
    if (p.scrollPct != null) { e.scroll += p.scrollPct; e.scrollN++; }
    pageMap.set(p.path, e);
  }
  const topPages = [...pageMap.entries()].sort((a, b) => b[1].views - a[1].views).slice(0, 15).map(([path, e]) => ({
    path,
    views: e.views,
    avgDuration: e.durN ? Math.round(e.dur / e.durN) : 0,
    avgScroll: e.scrollN ? Math.round(e.scroll / e.scrollN) : 0,
  }));

  return {
    kpis: {
      visitors, newVisitors, sessions: sessionCount, pageviews: pvCount, avgDuration, bounceRate, loggedIn,
      pagesPerSession: sessionCount ? Number((pvCount / sessionCount).toFixed(1)) : 0,
    },
    series,
    devices: topBy(sessions, (s) => s.device),
    browsers: topBy(sessions, (s) => s.browser),
    oses: topBy(sessions, (s) => s.os),
    countries: topBy(sessions, (s) => s.country),
    sources: topBy(sessions, (s) => s.source),
    topPages,
  };
}

export type Overview = Awaited<ReturnType<typeof getOverview>>;

export async function getRecentSessions({ from, to, site }: Range, take = 100) {
  return prisma.visitSession.findMany({
    where: { startedAt: { gte: from, lte: to }, device: { not: 'bot' }, ...siteWhere(site) },
    orderBy: { startedAt: 'desc' },
    take,
    select: {
      id: true, site: true, startedAt: true, durationSec: true, pageviews: true, device: true, os: true, browser: true,
      country: true, region: true, city: true, source: true, entryPath: true, exitPath: true, userId: true, referrer: true,
    },
  });
}
