'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@noc/db';
import { requirePermission } from '@noc/auth';

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

// ─────────────────────────── Property Types ───────────────────────────

export async function upsertPropertyType(input: {
  id?: string;
  key: string;
  nameAr: string;
  nameEn: string;
  icon?: string | null;
  groupId?: string | null;
  order?: number;
  isActive?: boolean;
}): Promise<Result> {
  await requirePermission('marketplace', input.id ? 'UPDATE' : 'CREATE');
  const data = {
    nameAr: input.nameAr.trim(),
    nameEn: input.nameEn.trim(),
    icon: input.icon?.trim() || null,
    groupId: input.groupId || null,
    order: input.order ?? 0,
    isActive: input.isActive ?? true,
  };
  try {
    if (input.id) await prisma.propertyType.update({ where: { id: input.id }, data });
    else await prisma.propertyType.create({ data: { key: input.key.trim(), ...data } });
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deletePropertyType(id: string): Promise<Result> {
  await requirePermission('marketplace', 'DELETE');
  try {
    await prisma.propertyType.delete({ where: { id } });
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ──────────────────────── Categories + Groups ────────────────────────

export async function upsertPropertyCategory(input: {
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
    if (input.id) await prisma.propertyCategory.update({ where: { id: input.id }, data });
    else await prisma.propertyCategory.create({ data: { key: input.key.trim(), ...data } });
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deletePropertyCategory(id: string): Promise<Result> {
  await requirePermission('marketplace', 'DELETE');
  try {
    await prisma.propertyCategory.delete({ where: { id } });
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Groups are scoped to a category — bind categoryId on the server page. */
export async function upsertPropertyGroup(
  categoryId: string,
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
    if (input.id) await prisma.propertyGroup.update({ where: { id: input.id }, data });
    else await prisma.propertyGroup.create({ data: { categoryId, key: input.key.trim(), ...data } });
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deletePropertyGroup(id: string): Promise<Result> {
  await requirePermission('marketplace', 'DELETE');
  try {
    await prisma.propertyGroup.delete({ where: { id } });
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
  typeIds?: string[];
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
  const typeIds = input.typeIds ?? [];

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

      // Sync type mappings (delete missing, create new).
      const links = await tx.propertyTypeAttribute.findMany({ where: { attributeId: attr.id } });
      const want = new Set(typeIds);
      const have = new Set(links.map((l) => l.propertyTypeId));
      const removeLinks = links.filter((l) => !want.has(l.propertyTypeId)).map((l) => l.id);
      if (removeLinks.length)
        await tx.propertyTypeAttribute.deleteMany({ where: { id: { in: removeLinks } } });
      const addTypes = typeIds.filter((t) => !have.has(t));
      for (const t of addTypes) {
        await tx.propertyTypeAttribute.create({ data: { propertyTypeId: t, attributeId: attr.id } });
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
  phone1?: string;
  phone1Whatsapp?: boolean;
  phone2?: string;
  phone2Whatsapp?: boolean;
  details?: string;
}): Promise<Result> {
  await requirePermission('marketplace', input.id ? 'UPDATE' : 'CREATE');
  const data = {
    name: input.name.trim(),
    type: input.type,
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
