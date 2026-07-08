'use server';

import { revalidatePath } from 'next/cache';
import { prisma, Prisma } from '@noc/db';
import { requirePermission } from '@noc/auth';
import { isValidPhone } from '@noc/config';
import { ensureAdNumber } from '../../../../lib/adNumber';
import { regenerateListingImages } from '../../../../lib/poster/generate';
import { isPosterIcon } from '../../../../lib/poster/icons';
import { STANDARD_AREAS_KEY } from '../../../../lib/marketplace';

type Result = { ok: true } | { ok: false; error: string };

export type AttrTypeKey =
  | 'TEXT' | 'TEXTAREA' | 'NUMBER' | 'BOOLEAN' | 'SELECT' | 'MULTI_SELECT' | 'DATE' | 'PHOTOS' | 'DOCUMENTS'
  | 'URL' | 'PHONE' | 'DATE_FULL' | 'MONEY' | 'MONEY_THOUSANDS' | 'AREA_ORIGINAL' | 'AREA_ALLOCATED' | 'YESNO'
  | 'DISTRICT' | 'NEIGHBORHOOD';

function revalidate() {
  revalidatePath('/admin/marketplace', 'layout');
}

function fail(e: unknown): Result {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes('Foreign key') || msg.includes('P2003') || msg.includes('Restrict')) {
    return { ok: false, error: 'in_use' };
  }
  if (msg.includes('Unique constraint') || msg.includes('P2002')) {
    return { ok: false, error: 'duplicate_key' };
  }
  return { ok: false, error: 'failed' };
}

// ───────────────── Classifiers (Type / Purpose / Condition) options ─────────────────

/** Options are scoped to a classifier — bind classifierId on the server page. */
export async function upsertClassifierOption(
  classifierId: string,
  input: { id?: string; key: string; nameAr: string; nameEn: string; order?: number; isActive?: boolean; parentIds?: string[]; allowedOnAlsawarey?: boolean },
): Promise<Result> {
  await requirePermission('marketplace', input.id ? 'UPDATE' : 'CREATE');
  const data = {
    nameAr: input.nameAr.trim(),
    nameEn: input.nameEn.trim(),
    order: input.order ?? 0,
    isActive: input.isActive ?? true,
    allowedOnAlsawarey: input.allowedOnAlsawarey ?? true,
  };
  const parentIds = [...new Set((input.parentIds ?? []).filter(Boolean))];
  try {
    const opt = input.id
      ? await prisma.classifierOption.update({ where: { id: input.id }, data })
      : await prisma.classifierOption.create({ data: { classifierId, key: input.key.trim(), ...data } });
    // Reconcile the many-to-many parents (a sub-option can sit under several parents).
    await prisma.classifierOptionParent.deleteMany({ where: { childId: opt.id } });
    if (parentIds.length) {
      await prisma.classifierOptionParent.createMany({
        data: parentIds.map((parentId) => ({ childId: opt.id, parentId })),
        skipDuplicates: true,
      });
    }
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function saveStandardAreas(list: number[]): Promise<Result> {
  await requirePermission('marketplace', 'UPDATE');
  const clean = [...new Set(list.map(Number).filter((n) => Number.isFinite(n) && n > 0))].sort((a, b) => a - b);
  try {
    await prisma.setting.upsert({
      where: { key: STANDARD_AREAS_KEY },
      update: { value: JSON.stringify(clean) },
      create: { key: STANDARD_AREAS_KEY, value: JSON.stringify(clean) },
    });
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// Persist a new display order (order = position in the given id list).
async function reorderRows(ids: string[], update: (id: string, order: number) => Promise<unknown>): Promise<Result> {
  await requirePermission('marketplace', 'UPDATE');
  try {
    await prisma.$transaction(ids.map((id, i) => update(id, i) as Prisma.PrismaPromise<unknown>));
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function reorderClassifierOptions(ids: string[]): Promise<Result> {
  return reorderRows(ids, (id, order) => prisma.classifierOption.update({ where: { id }, data: { order } }));
}
export async function reorderAttributes(ids: string[]): Promise<Result> {
  return reorderRows(ids, (id, order) => prisma.attribute.update({ where: { id }, data: { order } }));
}
export async function reorderSections(ids: string[]): Promise<Result> {
  return reorderRows(ids, (id, order) => prisma.attributeSection.update({ where: { id }, data: { order } }));
}

export async function deleteClassifierOption(id: string): Promise<Result> {
  await requirePermission('marketplace', 'DELETE');
  try {
    await prisma.classifierOption.delete({ where: { id } });
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// Quick toggle of a single flag from the options list (click the status icon).
export async function toggleClassifierOptionFlag(
  id: string,
  flag: 'isActive' | 'allowedOnAlsawarey',
  value: boolean,
): Promise<Result> {
  await requirePermission('marketplace', 'UPDATE');
  try {
    await prisma.classifierOption.update({ where: { id }, data: { [flag]: value } });
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ───────────────────────────── Sections ─────────────────────────────

export async function upsertSection(input: {
  id?: string;
  key: string;
  nameAr: string;
  nameEn: string;
  icon?: string | null;
  order?: number;
  isActive?: boolean;
}): Promise<Result> {
  await requirePermission('marketplace', input.id ? 'UPDATE' : 'CREATE');
  const data = {
    nameAr: input.nameAr.trim(),
    nameEn: input.nameEn.trim(),
    // Only touch icon when explicitly provided — the CatalogTable edit form doesn't
    // send it, and it must not wipe an icon assigned via the SectionIconPicker.
    ...(input.icon !== undefined ? { icon: input.icon?.trim() || null } : {}),
    order: input.order ?? 0,
    isActive: input.isActive ?? true,
  };
  try {
    if (input.id) await prisma.attributeSection.update({ where: { id: input.id }, data });
    else await prisma.attributeSection.create({ data: { key: input.key.trim(), ...data } });
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteSection(id: string): Promise<Result> {
  await requirePermission('marketplace', 'DELETE');
  try {
    await prisma.attributeSection.delete({ where: { id } });
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Save the generated-image marks for a Type option: which attribute groups get their
 *  own small card and which appear on the big poster. Only non-default rows are stored
 *  (default = card yes, poster no → the generator's first-3 fallback applies while no
 *  poster rows exist for the option). */
export async function setCategorySectionRender(
  optionId: string,
  marks: Array<{ sectionId: string; makeCard: boolean; onPoster: boolean }>,
): Promise<Result> {
  await requirePermission('marketplace', 'UPDATE');
  try {
    const rows = marks
      .filter((m) => !m.makeCard || m.onPoster)
      .map((m) => ({ optionId, sectionId: m.sectionId, makeCard: m.makeCard, onPoster: m.onPoster }));
    await prisma.$transaction([
      prisma.categorySectionRender.deleteMany({ where: { optionId } }),
      ...(rows.length ? [prisma.categorySectionRender.createMany({ data: rows })] : []),
    ]);
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Assign the generated-photos icon for a section (null = auto cycle). */
export async function setSectionIcon(id: string, icon: string | null): Promise<Result> {
  await requirePermission('marketplace', 'UPDATE');
  if (icon !== null && !isPosterIcon(icon)) return { ok: false, error: 'failed' };
  try {
    await prisma.attributeSection.update({ where: { id }, data: { icon } });
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ──────────────────────────── Attributes ────────────────────────────

export type AttrOptionInput = {
  id?: string;
  key: string;
  labelAr: string;
  labelEn: string;
  order?: number;
  isActive?: boolean;
};

export async function upsertAttribute(input: {
  id?: string;
  key: string;
  sectionId: string;
  labelAr: string;
  labelEn: string;
  type: AttrTypeKey;
  unit?: string | null;
  helpAr?: string | null;
  helpEn?: string | null;
  config?: Record<string, string | boolean> | null;
  filterable?: boolean;
  order?: number;
  isActive?: boolean;
  optionListId?: string | null; // shared OptionList for SELECT / MULTI_SELECT
  optionIds?: string[]; // ClassifierOption ids the attribute applies to (Type/Purpose/Condition)
}): Promise<Result> {
  await requirePermission('marketplace', input.id ? 'UPDATE' : 'CREATE');
  const cfg = input.config && Object.keys(input.config).length ? input.config : null;
  const usesList = input.type === 'SELECT' || input.type === 'MULTI_SELECT';
  const core = {
    sectionId: input.sectionId,
    labelAr: input.labelAr.trim(),
    labelEn: input.labelEn.trim(),
    type: input.type,
    unit: input.unit?.trim() || null,
    helpAr: input.helpAr?.trim() || null,
    helpEn: input.helpEn?.trim() || null,
    config: cfg ?? Prisma.JsonNull,
    optionListId: usesList ? input.optionListId || null : null,
    filterable: input.filterable ?? false,
    order: input.order ?? 0,
    isActive: input.isActive ?? true,
  };
  const optionIds = input.optionIds ?? [];

  try {
    await prisma.$transaction(async (tx) => {
      const attr = input.id
        ? await tx.attribute.update({ where: { id: input.id }, data: core })
        : await tx.attribute.create({ data: { key: input.key.trim(), ...core } });

      // SELECT/MULTI_SELECT choices live in the shared OptionList now; legacy inline
      // AttributeOption rows are left untouched (old data + saved values depend on them).

      // Sync classifier applicability (delete missing, create new).
      const links = await tx.attributeClassifier.findMany({ where: { attributeId: attr.id } });
      const want = new Set(optionIds);
      const have = new Set(links.map((l) => l.optionId));
      const removeLinks = links.filter((l) => !want.has(l.optionId)).map((l) => l.id);
      if (removeLinks.length)
        await tx.attributeClassifier.deleteMany({ where: { id: { in: removeLinks } } });
      const addOpts = optionIds.filter((o) => !have.has(o));
      for (const o of addOpts) {
        await tx.attributeClassifier.create({ data: { optionId: o, attributeId: attr.id } });
      }
    });
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// Category-centric applicability: set which attributes apply to one classifier option
// (the inverse of picking options inside the attribute form).
export async function setOptionAttributes(optionId: string, attributeIds: string[]): Promise<Result> {
  await requirePermission('marketplace', 'UPDATE');
  try {
    const existing = await prisma.attributeClassifier.findMany({ where: { optionId }, select: { id: true, attributeId: true } });
    const want = new Set(attributeIds);
    const have = new Set(existing.map((e) => e.attributeId));
    const toDelete = existing.filter((e) => !want.has(e.attributeId)).map((e) => e.id);
    const toAdd = attributeIds.filter((a) => !have.has(a));
    if (toDelete.length) await prisma.attributeClassifier.deleteMany({ where: { id: { in: toDelete } } });
    if (toAdd.length) await prisma.attributeClassifier.createMany({ data: toAdd.map((attributeId) => ({ optionId, attributeId })), skipDuplicates: true });
    // No revalidate() here: this is an optimistic per-toggle auto-save. A layout-wide
    // revalidatePath on every checkbox tick refreshes the whole marketplace admin subtree,
    // which interrupts the next click (you could only tick one box per reload). Callers that
    // need fresh data (CategoryAttributesManager) call router.refresh() themselves after Save.
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteAttribute(id: string): Promise<Result> {
  await requirePermission('marketplace', 'DELETE');
  try {
    // Clear every dependent row first so ANY attribute can be removed — even one
    // linked to categories or with saved listing values. Schema cascades would
    // handle this too, but doing it explicitly in one transaction makes deletion
    // independent of DB-level FK settings. (Attachment.attributeId is a loose tag
    // with no FK, so it neither blocks nor needs cleanup here.)
    await prisma.$transaction([
      prisma.listingValue.deleteMany({ where: { attributeId: id } }),
      prisma.attributeClassifier.deleteMany({ where: { attributeId: id } }),
      prisma.propertyTypeAttribute.deleteMany({ where: { attributeId: id } }),
      prisma.attributeOption.deleteMany({ where: { attributeId: id } }),
      prisma.attribute.delete({ where: { id } }),
    ]);
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ─────────────────────── Reusable option lists ───────────────────────

export type OptionItemInput = { id?: string; key: string; labelAr: string; labelEn: string; order?: number; isActive?: boolean };

export async function upsertOptionList(input: { id?: string; name: string; items: OptionItemInput[] }): Promise<Result> {
  await requirePermission('marketplace', input.id ? 'UPDATE' : 'CREATE');
  const name = input.name.trim();
  if (!name) return { ok: false, error: 'failed' };
  try {
    await prisma.$transaction(async (tx) => {
      const list = input.id
        ? await tx.optionList.update({ where: { id: input.id }, data: { name } })
        : await tx.optionList.create({ data: { name } });
      // Sync items by id (removing an item also removes it from listings that used it).
      const existing = await tx.optionListItem.findMany({ where: { listId: list.id } });
      const keep = new Set(input.items.filter((i) => i.id).map((i) => i.id));
      const del = existing.filter((e) => !keep.has(e.id)).map((e) => e.id);
      if (del.length) await tx.optionListItem.deleteMany({ where: { id: { in: del } } });
      for (const [i, it] of input.items.entries()) {
        const data = { key: it.key.trim(), labelAr: it.labelAr.trim(), labelEn: it.labelEn.trim(), order: it.order ?? i, isActive: it.isActive ?? true };
        if (it.id) await tx.optionListItem.update({ where: { id: it.id }, data });
        else await tx.optionListItem.create({ data: { listId: list.id, ...data } });
      }
    });
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteOptionList(id: string): Promise<Result> {
  await requirePermission('marketplace', 'DELETE');
  const used = await prisma.attribute.count({ where: { optionListId: id } });
  if (used > 0) return { ok: false, error: 'in_use' };
  try {
    await prisma.optionList.delete({ where: { id } });
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Bulk: regenerate the poster/card/advantages images for every published listing
 *  (run after a design change). Best-effort per listing; returns how many succeeded. */
/** Regenerate images for all published listings — optionally only one category (Type option). */
export async function regenerateAllListingImages(typeOptionId?: string): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  await requirePermission('marketplace', 'UPDATE');
  try {
    const ids = (
      await prisma.listing.findMany({
        where: { status: 'PUBLISHED', ...(typeOptionId ? { typeOptionId } : {}) },
        select: { id: true },
      })
    ).map((l) => l.id);
    let count = 0;
    for (const id of ids) {
      try { await regenerateListingImages(id); count++; } catch (e) { console.error('regenerateAll failed for', id, e); }
    }
    return { ok: true, count };
  } catch (e) {
    console.error('regenerateAllListingImages failed', e);
    return { ok: false, error: 'failed' };
  }
}

// ──────────────────────────── Moderation ────────────────────────────

export async function approveListing(id: string): Promise<Result> {
  await requirePermission('marketplace', 'UPDATE');
  try {
    await prisma.listing.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date(), rejectionReason: null },
    });
    // Assign the public ad number on first publish (no-op if already set or owner lacks a number).
    await ensureAdNumber(id);
    // Auto-generate the listing's image set (poster/cards/advantages) — fire-and-forget so
    // publishing stays snappy; failures are logged, not surfaced.
    void regenerateListingImages(id).catch((e) => console.error('auto-generate posters failed', e));
    revalidatePath('/admin/marketplace/listings', 'page');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function toggleFeatured(id: string, featured: boolean): Promise<Result> {
  await requirePermission('marketplace', 'UPDATE');
  try {
    await prisma.listing.update({ where: { id }, data: { featured } });
    revalidatePath('/admin/marketplace/listings', 'page');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function rejectListing(id: string, reason: string): Promise<Result> {
  await requirePermission('marketplace', 'UPDATE');
  try {
    await prisma.listing.update({
      where: { id },
      data: { status: 'REJECTED', rejectionReason: reason.trim() || null },
    });
    revalidatePath('/admin/marketplace/listings', 'page');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ────────────────────────── Owners + Settings ──────────────────────────

type OwnerTypeKey = 'PERSONAL' | 'COMPANY' | 'BROKER' | 'US';

export async function upsertOwner(input: {
  id?: string;
  name: string;
  type: OwnerTypeKey;
  codes?: number[]; // allocated ad codes (Us 0–9, Company/Broker 10–79). Personal owners hold none.
  phone1?: string;
  phone1Whatsapp?: boolean;
  phone2?: string;
  phone2Whatsapp?: boolean;
  details?: string;
}): Promise<Result> {
  await requirePermission('marketplace', input.id ? 'UPDATE' : 'CREATE');
  const name = input.name.trim();
  if (!name) return { ok: false, error: 'failed' };
  if (input.phone1?.trim() && !isValidPhone(input.phone1)) return { ok: false, error: 'invalid_phone' };
  if (input.phone2?.trim() && !isValidPhone(input.phone2)) return { ok: false, error: 'invalid_phone' };

  // Personal owners hold no code; coded owners are range-checked by type.
  let codes: number[] = [];
  if (input.type !== 'PERSONAL') {
    codes = Array.from(new Set((input.codes ?? []).map((c) => Math.trunc(c)).filter((c) => Number.isFinite(c))));
    const [lo, hi] = input.type === 'US' ? [0, 9] : [10, 79];
    if (codes.some((c) => c < lo || c > hi)) return { ok: false, error: 'owner_code_range' };
  }

  const data = {
    name,
    type: input.type,
    phone1: input.phone1?.trim() || null,
    phone1Whatsapp: !!input.phone1Whatsapp,
    phone2: input.phone2?.trim() || null,
    phone2Whatsapp: !!input.phone2Whatsapp,
    details: input.details?.trim() || null,
  };
  try {
    await prisma.$transaction(async (tx) => {
      const owner = input.id
        ? await tx.owner.update({ where: { id: input.id }, data })
        : await tx.owner.create({ data });
      const existing = (await tx.ownerCode.findMany({ where: { ownerId: owner.id }, select: { code: true } })).map((e) => e.code);
      const want = new Set(codes);
      const toDelete = existing.filter((c) => !want.has(c));
      const toAdd = codes.filter((c) => !existing.includes(c));
      if (toDelete.length) await tx.ownerCode.deleteMany({ where: { ownerId: owner.id, code: { in: toDelete } } });
      for (const code of toAdd) await tx.ownerCode.create({ data: { ownerId: owner.id, code } });
    });
    revalidatePath('/admin/marketplace/owners', 'page');
    return { ok: true };
  } catch (e) {
    if ((e as { code?: string })?.code === 'P2002') return { ok: false, error: 'owner_code_taken' };
    return fail(e);
  }
}

export async function deleteOwner(id: string): Promise<Result> {
  await requirePermission('marketplace', 'DELETE');
  try {
    await prisma.owner.delete({ where: { id } });
    revalidatePath('/admin/marketplace/owners', 'page');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function updateSetting(key: string, value: string): Promise<Result> {
  await requirePermission('marketplace', 'UPDATE');
  // Phone-type settings must satisfy the shared phone rule when non-empty.
  if (/_phone$/.test(key) && value.trim() && !isValidPhone(value)) {
    return { ok: false, error: 'invalid_phone' };
  }
  try {
    await prisma.setting.upsert({
      where: { key },
      update: { value: value.trim() },
      create: { key, value: value.trim() },
    });
    revalidatePath('/admin/marketplace', 'layout');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
