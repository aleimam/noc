'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@noc/db';
import { requirePermission } from '@noc/auth';
import { ensureAdNumber } from '../../../../lib/adNumber';

type Result = { ok: true } | { ok: false; error: string };

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
  input: { id?: string; key: string; nameAr: string; nameEn: string; order?: number; isActive?: boolean },
): Promise<Result> {
  await requirePermission('marketplace', input.id ? 'UPDATE' : 'CREATE');
  const data = {
    nameAr: input.nameAr.trim(),
    nameEn: input.nameEn.trim(),
    order: input.order ?? 0,
    isActive: input.isActive ?? true,
  };
  try {
    if (input.id) await prisma.classifierOption.update({ where: { id: input.id }, data });
    else await prisma.classifierOption.create({ data: { classifierId, key: input.key.trim(), ...data } });
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
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
    icon: input.icon?.trim() || null,
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
  type: 'TEXT' | 'TEXTAREA' | 'NUMBER' | 'BOOLEAN' | 'SELECT' | 'MULTI_SELECT' | 'DATE' | 'PHOTOS' | 'DOCUMENTS';
  unit?: string | null;
  helpAr?: string | null;
  helpEn?: string | null;
  filterable?: boolean;
  order?: number;
  isActive?: boolean;
  options?: AttrOptionInput[];
  optionIds?: string[]; // ClassifierOption ids the attribute applies to (Type/Purpose/Condition)
}): Promise<Result> {
  await requirePermission('marketplace', input.id ? 'UPDATE' : 'CREATE');
  const core = {
    sectionId: input.sectionId,
    labelAr: input.labelAr.trim(),
    labelEn: input.labelEn.trim(),
    type: input.type,
    unit: input.unit?.trim() || null,
    helpAr: input.helpAr?.trim() || null,
    helpEn: input.helpEn?.trim() || null,
    filterable: input.filterable ?? false,
    order: input.order ?? 0,
    isActive: input.isActive ?? true,
  };
  const hasOptions = input.type === 'SELECT' || input.type === 'MULTI_SELECT';
  const options = hasOptions ? (input.options ?? []) : [];
  const optionIds = input.optionIds ?? [];

  try {
    await prisma.$transaction(async (tx) => {
      const attr = input.id
        ? await tx.attribute.update({ where: { id: input.id }, data: core })
        : await tx.attribute.create({ data: { key: input.key.trim(), ...core } });

      // Sync options (by id; delete missing, upsert present).
      const existing = await tx.attributeOption.findMany({ where: { attributeId: attr.id } });
      const keepIds = new Set(options.filter((o) => o.id).map((o) => o.id));
      const toDelete = existing.filter((o) => !keepIds.has(o.id)).map((o) => o.id);
      if (toDelete.length) await tx.attributeOption.deleteMany({ where: { id: { in: toDelete } } });
      for (const [i, o] of options.entries()) {
        const odata = {
          key: o.key.trim(),
          labelAr: o.labelAr.trim(),
          labelEn: o.labelEn.trim(),
          order: o.order ?? i,
          isActive: o.isActive ?? true,
        };
        if (o.id) await tx.attributeOption.update({ where: { id: o.id }, data: odata });
        else await tx.attributeOption.create({ data: { attributeId: attr.id, ...odata } });
      }

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

export async function deleteAttribute(id: string): Promise<Result> {
  await requirePermission('marketplace', 'DELETE');
  try {
    await prisma.attribute.delete({ where: { id } });
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e);
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

type OwnerTypeKey = 'OWNER' | 'COMPANY' | 'BROKER' | 'US';

export async function upsertOwner(input: {
  id?: string;
  name: string;
  type: OwnerTypeKey;
  ownerNo?: number | null;
  phone1?: string;
  phone1Whatsapp?: boolean;
  phone2?: string;
  phone2Whatsapp?: boolean;
  details?: string;
}): Promise<Result> {
  await requirePermission('marketplace', input.id ? 'UPDATE' : 'CREATE');
  const ownerNo = input.ownerNo == null || Number.isNaN(input.ownerNo) ? null : Math.trunc(input.ownerNo);
  if (ownerNo != null && (ownerNo < 0 || ownerNo > 99)) return { ok: false, error: 'owner_no_range' };
  const data = {
    name: input.name.trim(),
    type: input.type,
    ownerNo,
    phone1: input.phone1?.trim() || null,
    phone1Whatsapp: !!input.phone1Whatsapp,
    phone2: input.phone2?.trim() || null,
    phone2Whatsapp: !!input.phone2Whatsapp,
    details: input.details?.trim() || null,
  };
  try {
    if (input.id) await prisma.owner.update({ where: { id: input.id }, data });
    else await prisma.owner.create({ data });
    revalidatePath('/admin/marketplace/owners', 'page');
    return { ok: true };
  } catch (e) {
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
