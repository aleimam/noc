// Server-side soft search over the rationing ledger. Matches against normalized
// columns (spaces/diacritics/digits already folded), so queries are forgiving.
import { prisma, Prisma } from '@noc/db';
import { normalizeArabic, similarity } from './text';

export type SearchField = 'all' | 'name' | 'owner' | 'plot' | 'block';
export type SortKey = 'name' | 'plot' | 'newest';

function sheetOrderBy(sort?: SortKey): Prisma.RationingSheetOrderByWithRelationInput[] {
  if (sort === 'plot') return [{ plotNo: 'asc' }, { applicantName: 'asc' }];
  if (sort === 'newest') return [{ listDate: 'desc' }, { applicantName: 'asc' }];
  return [{ applicantName: 'asc' }];
}

export type SheetCard = {
  id: string;
  applicantName: string;
  plotNo: string;
  blockNo: string;
  plotFullRef: string | null;
  originalOwner: string | null;
  cityName: string | null;
};

export type Suggestion = { display: string; score: number };

export type SearchOutcome = {
  results: SheetCard[];
  total: number;
  suggestions: Suggestion[];
};

const MAX_SUGGESTION_POOL = 8000;

function toCard(s: {
  id: string;
  applicantName: string;
  plotNo: string;
  blockNo: string;
  plotFullRef: string | null;
  originalOwner: string | null;
  city: { name: string } | null;
}): SheetCard {
  return {
    id: s.id,
    applicantName: s.applicantName,
    plotNo: s.plotNo,
    blockNo: s.blockNo,
    plotFullRef: s.plotFullRef,
    originalOwner: s.originalOwner,
    cityName: s.city?.name ?? null,
  };
}

async function buildConditions(norm: string, field: SearchField): Promise<Prisma.RationingSheetWhereInput[]> {
  const conditions: Prisma.RationingSheetWhereInput[] = [];
  if (field === 'all' || field === 'name') {
    const names = await prisma.rationingName.findMany({
      where: { normalized: { contains: norm } },
      select: { sheetId: true },
      take: 3000,
    });
    const ids = [...new Set(names.map((n) => n.sheetId))];
    if (ids.length) conditions.push({ id: { in: ids } });
  }
  if (field === 'all' || field === 'owner') conditions.push({ ownerNorm: { contains: norm } });
  if (field === 'all' || field === 'plot') conditions.push({ plotNorm: { contains: norm } });
  if (field === 'all' || field === 'block') conditions.push({ blockNorm: { contains: norm } });
  return conditions;
}

/** Rank near-miss suggestions for text fields when a search returns nothing. */
async function computeSuggestions(norm: string, field: SearchField): Promise<Suggestion[]> {
  const pool: { display: string; norm: string }[] = [];
  if (field === 'all' || field === 'name') {
    const names = await prisma.rationingName.findMany({ select: { fullName: true, normalized: true }, take: MAX_SUGGESTION_POOL });
    for (const n of names) pool.push({ display: n.fullName, norm: n.normalized });
  }
  if (field === 'all' || field === 'owner') {
    const owners = await prisma.rationingSheet.findMany({
      where: { originalOwner: { not: null } },
      select: { originalOwner: true, ownerNorm: true },
      distinct: ['ownerNorm'],
      take: MAX_SUGGESTION_POOL,
    });
    for (const o of owners) if (o.originalOwner && o.ownerNorm) pool.push({ display: o.originalOwner, norm: o.ownerNorm });
  }
  const ranked = pool
    .map((p) => ({ display: p.display, score: similarity(norm, p.norm) }))
    .filter((p) => p.score >= 0.55)
    .sort((a, b) => b.score - a.score);
  // de-dupe by display, keep best
  const seen = new Set<string>();
  const out: Suggestion[] = [];
  for (const r of ranked) {
    if (seen.has(r.display)) continue;
    seen.add(r.display);
    out.push(r);
    if (out.length >= 5) break;
  }
  return out;
}

export async function searchSheets(opts: {
  q: string;
  field: SearchField;
  cityId?: string;
  take?: number;
  skip?: number;
  sort?: SortKey;
  withSuggestions?: boolean;
}): Promise<SearchOutcome> {
  const norm = normalizeArabic(opts.q);
  const take = opts.take ?? 50;
  const skip = opts.skip ?? 0;
  if (!norm) return { results: [], total: 0, suggestions: [] };

  const conditions = await buildConditions(norm, opts.field);
  if (conditions.length === 0) {
    const suggestions = opts.withSuggestions ? await computeSuggestions(norm, opts.field) : [];
    return { results: [], total: 0, suggestions };
  }

  const where: Prisma.RationingSheetWhereInput = {
    AND: [{ OR: conditions }, opts.cityId ? { cityId: opts.cityId } : {}],
  };

  const [rows, total] = await Promise.all([
    prisma.rationingSheet.findMany({
      where,
      include: { city: { select: { name: true } } },
      orderBy: sheetOrderBy(opts.sort),
      take,
      skip,
    }),
    prisma.rationingSheet.count({ where }),
  ]);

  const suggestions = total === 0 && opts.withSuggestions ? await computeSuggestions(norm, opts.field) : [];
  return { results: rows.map(toCard), total, suggestions };
}

export type PlotRow = { ref: string; plotNo: string; blockNo: string; cityName: string | null; owner: string | null; count: number };

/** Plots tab: distinct plots (by plot full reference) with applicant counts. Filter/sort/paginate in JS. */
export async function plotGroups(opts: { q?: string; cityId?: string; sort?: 'plot' | 'count'; take?: number; skip?: number } = {}): Promise<{ rows: PlotRow[]; total: number }> {
  const baseWhere: Prisma.RationingSheetWhereInput = { plotFullRef: { not: null }, ...(opts.cityId ? { cityId: opts.cityId } : {}) };
  const [counts, reps] = await Promise.all([
    prisma.rationingSheet.groupBy({ by: ['plotFullRef'], where: baseWhere, _count: { _all: true } }),
    prisma.rationingSheet.findMany({
      where: baseWhere,
      distinct: ['plotFullRef'],
      select: { plotFullRef: true, plotNo: true, blockNo: true, originalOwner: true, city: { select: { name: true } } },
    }),
  ]);
  const countByRef = new Map(counts.map((c) => [c.plotFullRef as string, c._count._all]));
  let rows: PlotRow[] = reps.map((r) => ({
    ref: r.plotFullRef as string,
    plotNo: r.plotNo,
    blockNo: r.blockNo,
    cityName: r.city?.name ?? null,
    owner: r.originalOwner,
    count: countByRef.get(r.plotFullRef as string) ?? 0,
  }));

  const q = normalizeArabic(opts.q ?? '');
  if (q) rows = rows.filter((r) => normalizeArabic(`${r.ref} ${r.owner ?? ''} ${r.cityName ?? ''}`).includes(q));
  rows.sort((a, b) => (opts.sort === 'plot' ? a.ref.localeCompare(b.ref, 'ar') : b.count - a.count));

  const total = rows.length;
  const skip = opts.skip ?? 0;
  const take = opts.take ?? 10;
  return { rows: rows.slice(skip, skip + take), total };
}

/** Pre-search plots summary: total plots, plots-by-city (top 6), and the 5 most-recent plots. */
export async function plotsSummary(): Promise<{ totalPlots: number; byCity: { label: string; value: number }[]; recent: PlotRow[] }> {
  const reps = await prisma.rationingSheet.findMany({
    where: { plotFullRef: { not: null } },
    distinct: ['plotFullRef'],
    orderBy: [{ listDate: 'desc' }],
    select: { plotFullRef: true, plotNo: true, blockNo: true, originalOwner: true, city: { select: { name: true } } },
  });
  const totalPlots = reps.length;

  const cityMap = new Map<string, number>();
  for (const r of reps) {
    const c = r.city?.name ?? '—';
    cityMap.set(c, (cityMap.get(c) ?? 0) + 1);
  }
  const byCity = [...cityMap.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 6);

  const recentReps = reps.slice(0, 5);
  const refs = recentReps.map((r) => r.plotFullRef as string);
  const counts = refs.length
    ? await prisma.rationingSheet.groupBy({ by: ['plotFullRef'], where: { plotFullRef: { in: refs } }, _count: { _all: true } })
    : [];
  const cmap = new Map(counts.map((c) => [c.plotFullRef as string, c._count._all]));
  const recent: PlotRow[] = recentReps.map((r) => ({
    ref: r.plotFullRef as string,
    plotNo: r.plotNo,
    blockNo: r.blockNo,
    cityName: r.city?.name ?? null,
    owner: r.originalOwner,
    count: cmap.get(r.plotFullRef as string) ?? 0,
  }));

  return { totalPlots, byCity, recent };
}
