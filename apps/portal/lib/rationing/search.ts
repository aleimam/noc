// Server-side soft search over the rationing ledger. Matches against normalized
// columns (spaces/diacritics/digits already folded), so queries are forgiving.
import { prisma, Prisma } from '@noc/db';
import { normalizeArabic, similarity } from './text';

export type SearchField = 'all' | 'name' | 'owner' | 'plot' | 'block';

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
      orderBy: { applicantName: 'asc' },
      take,
      skip,
    }),
    prisma.rationingSheet.count({ where }),
  ]);

  const suggestions = total === 0 && opts.withSuggestions ? await computeSuggestions(norm, opts.field) : [];
  return { results: rows.map(toCard), total, suggestions };
}

/** Browse mode (no query): paginated list, optional city filter. */
export async function browseSheets(opts: { cityId?: string; take?: number; skip?: number }): Promise<{ results: SheetCard[]; total: number }> {
  const take = opts.take ?? 50;
  const skip = opts.skip ?? 0;
  const where: Prisma.RationingSheetWhereInput = opts.cityId ? { cityId: opts.cityId } : {};
  const [rows, total] = await Promise.all([
    prisma.rationingSheet.findMany({
      where,
      include: { city: { select: { name: true } } },
      orderBy: [{ listDate: 'desc' }, { applicantName: 'asc' }],
      take,
      skip,
    }),
    prisma.rationingSheet.count({ where }),
  ]);
  return { results: rows.map(toCard), total };
}
