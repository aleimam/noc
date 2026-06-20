'use server';

import { revalidatePath } from 'next/cache';
import { auth, requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';

type GeoLevel = 'district' | 'neighborhood' | 'block' | 'land';
function revDetail(level: GeoLevel, id: string) {
  if (level === 'district') revalidatePath(`/admin/lands/districts/${id}`);
  else if (level === 'neighborhood') revalidatePath(`/admin/lands/neighborhoods/${id}`);
}
function geoField(level: GeoLevel, id: string) {
  return level === 'district'
    ? { districtId: id }
    : level === 'neighborhood'
      ? { neighborhoodId: id }
      : level === 'block'
        ? { blockId: id }
        : { landId: id };
}

type Result = { ok: true; id?: string } | { ok: false; error: string };

function fail(e: unknown): Result {
  const code = (e as { code?: string })?.code;
  if (code === 'P2003' || code === 'P2014') return { ok: false, error: 'in_use' };
  if (code === 'P2002') return { ok: false, error: 'duplicate_key' };
  console.error('lands action failed', e);
  return { ok: false, error: 'failed' };
}

function rev() {
  revalidatePath('/admin/lands');
  revalidatePath('/admin/lands/districts');
  revalidatePath('/admin/lands/neighborhoods');
}

// ── Districts ──
export async function upsertDistrict(input: {
  id?: string;
  key: string;
  nameAr: string;
  nameEn: string;
  order?: number;
  isActive?: boolean;
}): Promise<Result> {
  await requirePermission('lands', input.id ? 'UPDATE' : 'CREATE');
  try {
    const data = {
      nameAr: input.nameAr.trim(),
      nameEn: input.nameEn.trim(),
      order: input.order ?? 0,
      isActive: input.isActive ?? true,
    };
    const row = input.id
      ? await prisma.district.update({ where: { id: input.id }, data })
      : await prisma.district.create({ data: { ...data, key: input.key.trim() } });
    rev();
    return { ok: true, id: row.id };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteDistrict(id: string): Promise<Result> {
  await requirePermission('lands', 'DELETE');
  try {
    await prisma.district.delete({ where: { id } });
    rev();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ── Neighborhoods ──
export async function upsertNeighborhood(input: {
  id?: string;
  districtId: string;
  nameAr: string;
  nameEn: string;
  hasBlocks?: boolean;
  assortedAreas?: boolean;
  areas?: number[];
  buildingTypes?: string[];
  mainRoads?: string[];
  order?: number;
  isActive?: boolean;
}): Promise<Result> {
  await requirePermission('lands', input.id ? 'UPDATE' : 'CREATE');
  try {
    const data = {
      districtId: input.districtId,
      nameAr: input.nameAr.trim(),
      nameEn: input.nameEn.trim(),
      hasBlocks: !!input.hasBlocks,
      assortedAreas: !!input.assortedAreas,
      areas: input.areas ?? [],
      buildingTypes: input.buildingTypes ?? [],
      mainRoads: input.mainRoads ?? [],
      order: input.order ?? 0,
      isActive: input.isActive ?? true,
    };
    const row = input.id
      ? await prisma.neighborhood.update({ where: { id: input.id }, data })
      : await prisma.neighborhood.create({ data });
    rev();
    return { ok: true, id: row.id };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteNeighborhood(id: string): Promise<Result> {
  await requirePermission('lands', 'DELETE');
  try {
    await prisma.neighborhood.delete({ where: { id } });
    rev();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ── Blocks ──
export async function upsertBlock(input: { id?: string; neighborhoodId: string; name: string; order?: number }): Promise<Result> {
  await requirePermission('lands', input.id ? 'UPDATE' : 'CREATE');
  try {
    const data = { name: input.name.trim(), order: input.order ?? 0 };
    const row = input.id
      ? await prisma.block.update({ where: { id: input.id }, data })
      : await prisma.block.create({ data: { ...data, neighborhoodId: input.neighborhoodId } });
    revalidatePath(`/admin/lands/neighborhoods/${input.neighborhoodId}`);
    rev();
    return { ok: true, id: row.id };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteBlock(id: string): Promise<Result> {
  await requirePermission('lands', 'DELETE');
  try {
    const b = await prisma.block.delete({ where: { id } });
    revalidatePath(`/admin/lands/neighborhoods/${b.neighborhoodId}`);
    rev();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ── Updates (dated timeline + photos, attachable to any geographic level) ──
export async function addGeoUpdate(input: {
  level: GeoLevel;
  targetId: string;
  body: string;
  happenedAt?: string;
  photoIds?: string[];
}): Promise<Result> {
  await requirePermission('lands', 'CREATE');
  const session = await auth();
  const uid = session?.user?.id ?? null;
  try {
    const body = input.body?.trim();
    if (!body) return { ok: false, error: 'failed' };
    let happenedAt: Date | undefined;
    if (input.happenedAt) {
      const d = new Date(input.happenedAt);
      if (!isNaN(d.getTime())) happenedAt = d;
    }
    const u = await prisma.geoUpdate.create({
      data: { body, createdById: uid, ...(happenedAt ? { happenedAt } : {}), ...geoField(input.level, input.targetId) },
    });
    if (input.photoIds?.length && uid) {
      await prisma.attachment.updateMany({
        where: { id: { in: input.photoIds }, uploaderId: uid },
        data: { ownerType: 'GeoUpdate', ownerId: u.id },
      });
    }
    revDetail(input.level, input.targetId);
    return { ok: true, id: u.id };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteGeoUpdate(id: string): Promise<Result> {
  await requirePermission('lands', 'DELETE');
  try {
    await prisma.attachment.updateMany({ where: { ownerType: 'GeoUpdate', ownerId: id }, data: { ownerType: null, ownerId: null } });
    await prisma.geoUpdate.delete({ where: { id } });
    revalidatePath('/admin/lands', 'layout');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ── Advantages (bilingual, per district or neighborhood) ──
export async function upsertAdvantage(input: {
  id?: string;
  level: 'district' | 'neighborhood';
  targetId: string;
  textAr: string;
  textEn?: string;
  order?: number;
}): Promise<Result> {
  await requirePermission('lands', input.id ? 'UPDATE' : 'CREATE');
  try {
    const base = { textAr: input.textAr.trim(), textEn: input.textEn?.trim() || null, order: input.order ?? 0 };
    if (!base.textAr) return { ok: false, error: 'failed' };
    if (input.id) await prisma.advantage.update({ where: { id: input.id }, data: base });
    else await prisma.advantage.create({ data: { ...base, ...geoField(input.level, input.targetId) } });
    revDetail(input.level, input.targetId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteAdvantage(id: string): Promise<Result> {
  await requirePermission('lands', 'DELETE');
  try {
    await prisma.advantage.delete({ where: { id } });
    revalidatePath('/admin/lands', 'layout');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ── Masterplan map (single image per district/neighborhood, via Attachment) ──
export async function setMasterplan(input: { level: 'district' | 'neighborhood'; targetId: string; attachmentId: string }): Promise<Result> {
  await requirePermission('lands', 'UPDATE');
  const session = await auth();
  const uid = session?.user?.id ?? null;
  try {
    await prisma.attachment.updateMany({ where: { ownerType: 'Masterplan', ownerId: input.targetId }, data: { ownerType: null, ownerId: null } });
    await prisma.attachment.updateMany({
      where: { id: input.attachmentId, ...(uid ? { uploaderId: uid } : {}) },
      data: { ownerType: 'Masterplan', ownerId: input.targetId },
    });
    revDetail(input.level, input.targetId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function clearMasterplan(input: { level: 'district' | 'neighborhood'; targetId: string }): Promise<Result> {
  await requirePermission('lands', 'UPDATE');
  try {
    await prisma.attachment.updateMany({ where: { ownerType: 'Masterplan', ownerId: input.targetId }, data: { ownerType: null, ownerId: null } });
    revDetail(input.level, input.targetId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
