import { prisma } from '@noc/db';

// Search Intelligence (Phase S1) — shared normalizer + fire-and-forget logger for the
// public search surfaces.
//
// ⚠️ MIRROR: this file is a copy of apps/portal/lib/search.ts (same pattern as advantages.ts /
// geoInheritance.ts). The brokerage app can't import portal lib, so normalizeSearch + logSearch
// are duplicated here and MUST stay identical to the portal version so the future search
// dashboard can union both sites' SearchLog rows. The Arabic normalizer below is copied from
// apps/portal/lib/rationing/text.ts (normalizeArabic) — keep it in sync too.

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩'; // U+0660..0669
const EXT_ARABIC_INDIC = '۰۱۲۳۴۵۶۷۸۹'; // U+06F0..06F9 (Persian/Urdu)

function toLatinDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹]/g, (d) => {
    const a = ARABIC_INDIC.indexOf(d);
    if (a !== -1) return String(a);
    return String(EXT_ARABIC_INDIC.indexOf(d));
  });
}

/** Copy of portal's normalizeArabic — strips tashkeel/tatweel, unifies alef/ya/ta-marbuta,
 *  latinizes digits, lowercases, and drops all spaces/punctuation. */
function normalizeArabic(input: string | null | undefined): string {
  if (!input) return '';
  let s = toLatinDigits(String(input));
  s = s.replace(/[ً-ٰٟـ]/g, '');
  s = s
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[ىئ]/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ء/g, '');
  s = s.toLowerCase().replace(/[^ء-ي0-9a-z]/g, '');
  return s;
}

/**
 * Normalize a free-text search query for forgiving Arabic matching.
 * Lowercases, applies the Arabic normalization above and collapses whitespace to single spaces.
 * Applied per whitespace-token (normalizeArabic strips spaces) so word boundaries survive and
 * callers can split on space for multi-term (AND) matching.
 */
export function normalizeSearch(s: string | null | undefined): string {
  if (!s) return '';
  return String(s)
    .trim()
    .split(/\s+/)
    .map((tok) => normalizeArabic(tok))
    .filter(Boolean)
    .join(' ');
}

export type SearchSurface = 'market' | 'storefront' | 'rationing';
export type SearchSite = 'newobour' | 'alsawarey';

/**
 * Record one public search. Fire-and-forget: never awaited, never throws to the caller.
 * `normalized` is computed here; `zeroResult` is derived from resultsCount. Call only for
 * non-empty queries.
 *
 * sessionId: the analytics session id lives in the visitor's localStorage (client-generated,
 * beaconed to /api/collect) — not a server-readable cookie, so it stays null here. Pass userId
 * (resolved from auth()) when a customer is signed in.
 */
export function logSearch(input: {
  site: SearchSite;
  surface: SearchSurface;
  query: string;
  resultsCount: number;
  usedFastSearch?: boolean;
  sessionId?: string | null;
  userId?: string | null;
}): void {
  const query = input.query.trim();
  if (!query) return;
  void prisma.searchLog
    .create({
      data: {
        site: input.site,
        surface: input.surface,
        sessionId: input.sessionId ?? null,
        userId: input.userId ?? null,
        query: query.slice(0, 2000),
        normalized: normalizeSearch(query).slice(0, 191),
        resultsCount: input.resultsCount,
        zeroResult: input.resultsCount === 0,
        usedFastSearch: input.usedFastSearch ?? false,
      },
    })
    .catch(() => {
      /* fire-and-forget: analytics must never break search */
    });
}

// ── Synonym expansion (Search Intelligence S3) ───────────────────────────────────────────
// Mirror of apps/portal/lib/search.ts. The admin-curated SearchSynonym dictionary: each row is an
// equivalence GROUP of interchangeable terms (stored pre-normalized, one per line). A query token in
// a group expands to match ANY term in that group. site/surface null = applies everywhere.

/** normalized-token → set of normalized variants (itself + everyone in its group(s)).
 *  Cached ~60s per process: synonyms change rarely but are consulted on EVERY search render,
 *  so an uncached findMany would be a per-request DB hit an attacker can multiply. */
type SynCacheEntry = { at: number; map: Map<string, Set<string>> };
const synCache = new Map<string, SynCacheEntry>();
const SYN_TTL_MS = 60 * 1000;

async function loadSynonymVariants(opts: { site: SearchSite; surface: SearchSurface }): Promise<Map<string, Set<string>>> {
  const key = `${opts.site}:${opts.surface}`;
  const hit = synCache.get(key);
  if (hit && Date.now() - hit.at < SYN_TTL_MS) return hit.map;
  const map = new Map<string, Set<string>>();
  try {
    const rows = await prisma.searchSynonym.findMany({
      where: {
        isActive: true,
        AND: [{ OR: [{ site: null }, { site: opts.site }] }, { OR: [{ surface: null }, { surface: opts.surface }] }],
      },
      select: { normalized: true },
    });
    for (const r of rows) {
      const group = r.normalized.split('\n').map((s) => s.trim()).filter(Boolean);
      if (group.length < 2) continue;
      for (const term of group) {
        const set = map.get(term) ?? new Set<string>();
        for (const g of group) set.add(g);
        map.set(term, set);
      }
    }
    synCache.set(key, { at: Date.now(), map });
  } catch {
    /* dictionary is best-effort — a failure must never break search */
  }
  return map;
}

/**
 * Expand each normalized query token to the list of variants it should match (itself + synonyms).
 * Caller keeps multi-term AND with each unit now an OR over its variants:
 *   expanded.every((alts) => alts.some((v) => haystack.includes(v))).
 *
 * Multi-word groups: besides single tokens we also probe each adjacent token PAIR against the
 * dictionary — a matching bigram is consumed as ONE unit (its variants replace both tokens).
 */
export async function expandSearchTerms(terms: string[], opts: { site: SearchSite; surface: SearchSurface }): Promise<string[][]> {
  if (terms.length === 0) return [];
  const map = await loadSynonymVariants(opts);
  if (map.size === 0) return terms.map((t) => [t]);
  const out: string[][] = [];
  for (let i = 0; i < terms.length; i++) {
    const bigram = i + 1 < terms.length ? `${terms[i]} ${terms[i + 1]}` : null;
    const bigramVariants = bigram ? map.get(bigram) : undefined;
    if (bigramVariants) {
      out.push(Array.from(bigramVariants));
      i++; // consumed two tokens
      continue;
    }
    const variants = map.get(terms[i]!);
    out.push(variants ? Array.from(variants) : [terms[i]!]);
  }
  return out;
}

// ── Autocomplete / trending (Search Intelligence S3c) — mirror of apps/portal/lib/search.ts ──
export type Suggestion = { text: string; kind: 'trending' | 'type' | 'district' | 'neighborhood' };

type CorpusItem = { text: string; norm: string; kind: 'type' | 'district' | 'neighborhood' };
let corpusCache: { at: number; items: CorpusItem[] } | null = null;
const CORPUS_TTL_MS = 5 * 60 * 1000;

async function loadCorpus(): Promise<CorpusItem[]> {
  if (corpusCache && Date.now() - corpusCache.at < CORPUS_TTL_MS) return corpusCache.items;
  const items: CorpusItem[] = [];
  try {
    const [types, districts, neighborhoods] = await Promise.all([
      prisma.classifierOption.findMany({ where: { isActive: true, classifier: { key: 'type' } }, select: { nameAr: true, nameEn: true } }),
      prisma.district.findMany({ where: { isActive: true }, select: { nameAr: true, nameEn: true } }),
      prisma.neighborhood.findMany({ where: { isActive: true }, select: { nameAr: true, nameEn: true } }),
    ]);
    const add = (text: string | null | undefined, kind: CorpusItem['kind']) => {
      const t = (text ?? '').trim();
      const norm = normalizeSearch(t);
      if (t && norm) items.push({ text: t, norm, kind });
    };
    for (const t of types) { add(t.nameAr, 'type'); add(t.nameEn, 'type'); }
    for (const d of districts) { add(d.nameAr, 'district'); add(d.nameEn, 'district'); }
    for (const n of neighborhoods) { add(n.nameAr, 'neighborhood'); add(n.nameEn, 'neighborhood'); }
    corpusCache = { at: Date.now(), items };
  } catch {
    return corpusCache?.items ?? [];
  }
  return items;
}

// Trending is derived from public, unauthenticated SearchLog writes, so it is hardened:
// windowed (last 14 days — a flood ages out), cached ~60s per process (no full-table groupBy per
// focus event), and the displayed sample capped at 60 chars (limits content-injection real estate).
const TRENDING_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const TRENDING_TTL_MS = 60 * 1000;
const trendingCache = new Map<string, { at: number; items: Suggestion[] }>();

/** Suggestions for the instant search box: corpus matches for a partial query, else trending. */
export async function getSearchSuggestions(qRaw: string, opts: { site: SearchSite; surface: SearchSurface }): Promise<Suggestion[]> {
  const q = normalizeSearch(qRaw);
  if (q.length < 2) {
    const cacheKey = `${opts.site}:${opts.surface}`;
    const cached = trendingCache.get(cacheKey);
    if (cached && Date.now() - cached.at < TRENDING_TTL_MS) return cached.items;
    try {
      const since = new Date(Date.now() - TRENDING_WINDOW_MS);
      const grouped = await prisma.searchLog.groupBy({
        by: ['normalized'],
        where: { site: opts.site, surface: opts.surface, zeroResult: false, normalized: { not: '' }, createdAt: { gte: since } },
        _count: { _all: true },
        orderBy: { _count: { normalized: 'desc' } },
        take: 6,
      });
      const norms = grouped.map((g) => g.normalized);
      if (!norms.length) return [];
      const samples = await prisma.searchLog.findMany({
        where: { site: opts.site, surface: opts.surface, normalized: { in: norms }, createdAt: { gte: since } },
        distinct: ['normalized'],
        orderBy: { createdAt: 'desc' },
        select: { normalized: true, query: true },
      });
      const byNorm = new Map(samples.map((s) => [s.normalized, s.query]));
      const items = grouped
        .map((g) => ({ text: (byNorm.get(g.normalized) || g.normalized).trim().slice(0, 60), kind: 'trending' as const }))
        .filter((s) => s.text);
      trendingCache.set(cacheKey, { at: Date.now(), items });
      return items;
    } catch {
      return [];
    }
  }
  const items = await loadCorpus();
  const seen = new Set<string>();
  const out: Suggestion[] = [];
  for (const pass of [(i: CorpusItem) => i.norm.startsWith(q), (i: CorpusItem) => i.norm.includes(q)]) {
    for (const i of items) {
      if (out.length >= 8) break;
      if (!pass(i) || seen.has(i.norm)) continue;
      seen.add(i.norm);
      out.push({ text: i.text, kind: i.kind });
    }
  }
  return out;
}
