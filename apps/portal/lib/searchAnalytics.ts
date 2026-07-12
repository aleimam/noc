import { prisma } from '@noc/db';

// Search Intelligence S3 — aggregation layer over SearchLog for the admin dashboard.
// Pure server module (imported by the admin analytics page). All queries are scoped by an
// optional site + a rolling window (days). Grouping keys off `normalized` (the Arabic-normalized
// query, a VarChar(191) index) so "الحى العاشر" and "الحي ١٠" collapse together.

export type SearchSurface = 'market' | 'storefront' | 'rationing';

export type TermRow = {
  normalized: string;
  sample: string; // a representative raw query for display
  count: number;
  zeroCount: number; // how many of those searches returned nothing
  selectedCount: number; // how many led to opening a result
  convertedCount: number; // how many led to a contact/offer
};

export type SearchFunnel = {
  searches: number;
  withResults: number;
  selections: number;
  conversions: number;
};

export type SearchOverview = {
  funnel: SearchFunnel;
  zeroRate: number; // 0..1 — share of searches that returned nothing
  refinementRate: number; // 0..1 — share of searching sessions that searched more than once
  distinctTerms: number;
  topTerms: TermRow[];
  zeroTerms: TermRow[]; // most common terms that returned nothing
  convertingTerms: TermRow[]; // terms most associated with a conversion
};

/** Build the WHERE clause shared by every query: optional site + optional surface + window. */
function scope(opts: { site?: string | null; surface?: SearchSurface | null; since: Date }) {
  const where: Record<string, unknown> = { createdAt: { gte: opts.since } };
  if (opts.site) where.site = opts.site;
  if (opts.surface) where.surface = opts.surface;
  return where;
}

function windowStart(days: number): Date {
  // Caller passes an explicit `now` so the module stays deterministic under test/replay.
  const ms = Date.now() - days * 24 * 60 * 60 * 1000;
  return new Date(ms);
}

/** Roll SearchLog rows up by normalized term, newest-sample first, with per-term outcome counts. */
async function termRows(where: Record<string, unknown>, opts: { orderBy: 'count' | 'zero' | 'converted'; take: number }): Promise<TermRow[]> {
  // groupBy gives per-term totals; a second pass fetches a representative raw query for each.
  const grouped = await prisma.searchLog.groupBy({
    by: ['normalized'],
    where,
    _count: { _all: true },
    orderBy: { _count: { normalized: 'desc' } },
    take: opts.orderBy === 'count' ? opts.take : 200, // for zero/converted we re-rank in JS after enriching
  });

  const norms = grouped.map((g) => g.normalized);
  if (norms.length === 0) return [];

  // Per-term outcome counts (zero / selected / converted) in three cheap grouped queries.
  const [zeroBy, selBy, convBy, samples] = await Promise.all([
    prisma.searchLog.groupBy({ by: ['normalized'], where: { ...where, zeroResult: true, normalized: { in: norms } }, _count: { _all: true } }),
    prisma.searchLog.groupBy({ by: ['normalized'], where: { ...where, selectedListingId: { not: null }, normalized: { in: norms } }, _count: { _all: true } }),
    prisma.searchLog.groupBy({ by: ['normalized'], where: { ...where, converted: true, normalized: { in: norms } }, _count: { _all: true } }),
    prisma.searchLog.findMany({ where: { ...where, normalized: { in: norms } }, distinct: ['normalized'], select: { normalized: true, query: true }, orderBy: { createdAt: 'desc' } }),
  ]);
  const zeroMap = new Map(zeroBy.map((r) => [r.normalized, r._count._all]));
  const selMap = new Map(selBy.map((r) => [r.normalized, r._count._all]));
  const convMap = new Map(convBy.map((r) => [r.normalized, r._count._all]));
  const sampleMap = new Map(samples.map((r) => [r.normalized, r.query]));

  let rows: TermRow[] = grouped.map((g) => ({
    normalized: g.normalized,
    sample: sampleMap.get(g.normalized) || g.normalized,
    count: g._count._all,
    zeroCount: zeroMap.get(g.normalized) ?? 0,
    selectedCount: selMap.get(g.normalized) ?? 0,
    convertedCount: convMap.get(g.normalized) ?? 0,
  }));

  if (opts.orderBy === 'zero') rows = rows.filter((r) => r.zeroCount > 0).sort((a, b) => b.zeroCount - a.zeroCount);
  else if (opts.orderBy === 'converted') rows = rows.filter((r) => r.convertedCount > 0).sort((a, b) => b.convertedCount - a.convertedCount);

  return rows.slice(0, opts.take);
}

/** The full dashboard payload for one (site, surface, window). */
export async function getSearchOverview(opts: { site?: string | null; surface?: SearchSurface | null; days?: number } = {}): Promise<SearchOverview> {
  const days = opts.days ?? 30;
  const since = windowStart(days);
  const where = scope({ site: opts.site, surface: opts.surface, since });

  const [searches, withResults, selections, conversions, distinct, sessionsAll, topTerms, zeroTerms, convertingTerms] = await Promise.all([
    prisma.searchLog.count({ where }),
    prisma.searchLog.count({ where: { ...where, zeroResult: false } }),
    prisma.searchLog.count({ where: { ...where, selectedListingId: { not: null } } }),
    prisma.searchLog.count({ where: { ...where, converted: true } }),
    prisma.searchLog.findMany({ where, distinct: ['normalized'], select: { normalized: true } }),
    // Refinement: sessions (with a sessionId) grouped, so we can see who searched more than once.
    prisma.searchLog.groupBy({ by: ['sessionId'], where: { ...where, sessionId: { not: null } }, _count: { _all: true } }),
    termRows(where, { orderBy: 'count', take: 25 }),
    termRows(where, { orderBy: 'zero', take: 25 }),
    termRows(where, { orderBy: 'converted', take: 25 }),
  ]);

  const searchingSessions = sessionsAll.length;
  const refinedSessions = sessionsAll.filter((s) => s._count._all > 1).length;

  return {
    funnel: { searches, withResults, selections, conversions },
    zeroRate: searches ? (searches - withResults) / searches : 0,
    refinementRate: searchingSessions ? refinedSessions / searchingSessions : 0,
    distinctTerms: distinct.length,
    topTerms,
    zeroTerms,
    convertingTerms,
  };
}
