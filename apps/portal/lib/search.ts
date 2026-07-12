import { prisma } from '@noc/db';
import { normalizeArabic } from './rationing/text';

// Search Intelligence (Phase S1) — shared normalizer + fire-and-forget logger for the
// public search surfaces. The brokerage app can't import portal lib, so this file is
// MIRRORED at apps/brokerage/lib/search.ts — keep the two identical (normalizeSearch +
// logSearch must behave the same on both sites so the future dashboard can union them).

/**
 * Normalize a free-text search query for forgiving Arabic matching.
 * Lowercases, applies the rationing Arabic normalization (strips tashkeel/tatweel, unifies
 * أإآ→ا, ة→ه, ى→ي, latinizes digits) and collapses whitespace to single spaces.
 *
 * NOTE: normalizeArabic strips ALL spaces/punctuation, so we apply it per whitespace-token
 * and rejoin with single spaces — this KEEPS word boundaries so callers can split on space
 * for multi-term (AND) matching, while each term is itself fully normalized.
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
 * Record one public search. Fire-and-forget: never awaited, never throws to the caller, so
 * it can't block or break the page render. `normalized` is computed here; `zeroResult` is
 * derived from resultsCount. Call only for non-empty queries.
 *
 * sessionId: the analytics session id lives in the visitor's localStorage (client-generated,
 * beaconed to /api/collect) — it is NOT exposed in a server-readable cookie, so it stays null
 * on these server-rendered results pages. Pass userId (resolved from auth()) when a user is
 * signed in.
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
// The admin-curated SearchSynonym dictionary. Each row is an equivalence GROUP of interchangeable
// terms stored pre-normalized (one per line). At search time a query token that belongs to a group
// expands to match ANY term in that group, so misspellings / dialect variants / EN⇄AR pairs stop
// returning zero results. Applied to the market + storefront keyword search (rationing has its own
// name-expansion + did-you-mean layer). site/surface null = applies everywhere.

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
      if (group.length < 2) continue; // a group of one expands to nothing useful
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
 * Returns one array per input token so the caller keeps its multi-term AND while each term is now an
 * OR over its variants:  expanded.every((alts) => alts.some((v) => haystack.includes(v))).
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
