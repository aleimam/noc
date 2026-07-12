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

/** normalized-token → set of normalized variants (itself + everyone in its group(s)). */
async function loadSynonymVariants(opts: { site: SearchSite; surface: SearchSurface }): Promise<Map<string, Set<string>>> {
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
  } catch {
    /* dictionary is best-effort — a failure must never break search */
  }
  return map;
}

/**
 * Expand each normalized query token to the list of variants it should match (itself + synonyms).
 * Caller keeps multi-term AND with each term now an OR over its variants:
 *   expanded.every((alts) => alts.some((v) => haystack.includes(v))).
 */
export async function expandSearchTerms(terms: string[], opts: { site: SearchSite; surface: SearchSurface }): Promise<string[][]> {
  if (terms.length === 0) return [];
  const map = await loadSynonymVariants(opts);
  if (map.size === 0) return terms.map((t) => [t]);
  return terms.map((t) => {
    const variants = map.get(t);
    return variants ? Array.from(variants) : [t];
  });
}
