'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { normalizeSearch } from '../../../../../lib/search';

// Server actions for the admin synonym dictionary (Search Intelligence S3b). Managing synonyms
// changes PUBLIC search behavior, so it's gated at MANAGE on the analytics section (viewing the
// dashboard only needs VIEW). `normalized` is derived from the raw terms with the same normalizer
// the public search uses, so an admin-entered "فيلا / villa" matches the way a visitor's query is.

const SITES = new Set(['newobour', 'alsawarey']);
const SURFACES = new Set(['market', 'storefront', 'rationing']);

/** Build the newline-separated normalized match keys from the admin's raw one-per-line terms. */
function buildNormalized(terms: string): string {
  return terms
    .split(/\r?\n/)
    .map((s) => normalizeSearch(s))
    .filter(Boolean)
    .join('\n');
}

export type SynonymInput = {
  id?: string;
  terms: string;
  site?: string | null;
  surface?: string | null;
  note?: string | null;
  isActive?: boolean;
};

export async function saveSynonym(input: SynonymInput): Promise<{ ok: boolean; error?: string }> {
  await requirePermission('analytics', 'MANAGE');
  const terms = (input.terms ?? '').trim();
  const normalized = buildNormalized(terms);
  // A useful group needs at least two distinct normalized terms.
  if (new Set(normalized.split('\n').filter(Boolean)).size < 2) return { ok: false, error: 'need_two_terms' };
  const data = {
    terms,
    normalized,
    site: input.site && SITES.has(input.site) ? input.site : null,
    surface: input.surface && SURFACES.has(input.surface) ? input.surface : null,
    note: input.note?.trim() || null,
    isActive: input.isActive !== false,
  };
  if (input.id) await prisma.searchSynonym.update({ where: { id: input.id }, data });
  else await prisma.searchSynonym.create({ data });
  revalidatePath('/admin/analytics/search');
  return { ok: true };
}

export async function toggleSynonym(id: string, isActive: boolean): Promise<{ ok: boolean }> {
  await requirePermission('analytics', 'MANAGE');
  await prisma.searchSynonym.update({ where: { id }, data: { isActive } });
  revalidatePath('/admin/analytics/search');
  return { ok: true };
}

export async function deleteSynonym(id: string): Promise<{ ok: boolean }> {
  await requirePermission('analytics', 'MANAGE');
  await prisma.searchSynonym.delete({ where: { id } });
  revalidatePath('/admin/analytics/search');
  return { ok: true };
}
