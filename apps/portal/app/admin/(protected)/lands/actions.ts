'use server';

import { revalidatePath } from 'next/cache';
import { auth, requirePermission, loadSmsConfig } from '@noc/auth';
import { prisma } from '@noc/db';
import { sendSms } from '@noc/sms';
import { stampMapCopy } from '../../../../lib/mapStamp';

type GeoLevel = 'district' | 'neighborhood' | 'block' | 'land';
function revDetail(level: GeoLevel, id: string) {
  if (level === 'district') {
    revalidatePath(`/admin/lands/districts/${id}`);
    revalidatePath(`/admin/lands/districts/${id}/edit`);
  } else if (level === 'neighborhood') {
    revalidatePath(`/admin/lands/neighborhoods/${id}`);
    revalidatePath(`/admin/lands/neighborhoods/${id}/edit`);
  }
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
  title?: string;
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
      data: { title: input.title?.trim() || null, body, createdById: uid, ...(happenedAt ? { happenedAt } : {}), ...geoField(input.level, input.targetId) },
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

function num(s?: string): number | null {
  if (!s) return null;
  const n = Number(s);
  return isNaN(n) ? null : n;
}

// ── Land records (internal find → refine → publish workflow) ──
type LandInput = {
  id?: string;
  landType: 'SHEETS' | 'ALLOCATED';
  neighborhoodId?: string | null;
  blockId?: string | null;
  pieceNo?: string;
  sheetLocation?: string;
  area?: string;
  allocationDate?: string;
  utilitiesStatus?: string;
  price?: string;
  ownerKind?: 'BROKER' | 'OWNER' | 'PERSONAL';
  ownerId?: string | null;
  details?: string;
  status?: 'DRAFT' | 'REFINED' | 'READY' | 'PUBLISHED' | 'ARCHIVED';
  photoIds?: string[];
};

export async function upsertLand(input: LandInput): Promise<Result> {
  await requirePermission('lands', input.id ? 'UPDATE' : 'CREATE');
  const session = await auth();
  const uid = session?.user?.id ?? null;
  try {
    const allocated = input.landType === 'ALLOCATED';
    const commercial = input.ownerKind === 'BROKER' || input.ownerKind === 'OWNER';
    const data = {
      landType: input.landType,
      neighborhoodId: allocated ? input.neighborhoodId || null : null,
      blockId: allocated ? input.blockId || null : null,
      pieceNo: input.pieceNo?.trim() || null,
      sheetLocation: !allocated ? input.sheetLocation || null : null,
      area: num(input.area),
      allocationDate: input.allocationDate ? new Date(input.allocationDate) : null,
      utilitiesStatus: input.utilitiesStatus?.trim() || null,
      price: num(input.price),
      ownerKind: input.ownerKind ?? null,
      ownerId: commercial ? input.ownerId || null : null,
      details: input.details?.trim() || null,
      status: input.status ?? 'DRAFT',
    };
    let landId: string;
    if (input.id) {
      await prisma.land.update({ where: { id: input.id }, data });
      landId = input.id;
    } else {
      const l = await prisma.land.create({ data: { ...data, createdById: uid } });
      landId = l.id;
    }
    if (input.photoIds && uid) {
      if (input.photoIds.length) {
        await prisma.attachment.updateMany({ where: { id: { in: input.photoIds }, uploaderId: uid }, data: { ownerType: 'Land', ownerId: landId } });
      }
      await prisma.attachment.updateMany({
        where: { ownerType: 'Land', ownerId: landId, ...(input.photoIds.length ? { id: { notIn: input.photoIds } } : {}) },
        data: { ownerType: null, ownerId: null },
      });
    }
    revalidatePath('/admin/lands/lands');
    return { ok: true, id: landId };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteLand(id: string): Promise<Result> {
  await requirePermission('lands', 'DELETE');
  try {
    await prisma.attachment.updateMany({ where: { ownerType: 'Land', ownerId: id }, data: { ownerType: null, ownerId: null } });
    await prisma.land.delete({ where: { id } });
    revalidatePath('/admin/lands/lands');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function setLandStatus(id: string, status: LandInput['status']): Promise<Result> {
  await requirePermission('lands', 'UPDATE');
  try {
    await prisma.land.update({ where: { id }, data: { status: status ?? 'DRAFT' } });
    revalidatePath('/admin/lands/lands');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// Publish a land as a marketplace listing (our inventory) and link them.
export async function publishLand(id: string): Promise<Result> {
  await requirePermission('lands', 'UPDATE');
  const session = await auth();
  const uid = session?.user?.id ?? null;
  if (!uid) return { ok: false, error: 'failed' };
  try {
    const land = await prisma.land.findUnique({ where: { id }, include: { neighborhood: { include: { district: true } } } });
    if (!land) return { ok: false, error: 'failed' };
    if (land.listingId) return { ok: false, error: 'duplicate_key' };

    const [landType, settings] = await Promise.all([
      prisma.classifierOption.findFirst({ where: { key: 'land', classifier: { key: 'type' } } }),
      prisma.setting.findMany({ where: { key: { in: ['alswarey_phone', 'alswarey_whatsapp'] } } }),
    ]);
    if (!landType) return { ok: false, error: 'failed' };
    const sett = Object.fromEntries(settings.map((s) => [s.key, s.value]));

    const loc = land.neighborhood ? `${land.neighborhood.district.nameAr} - ${land.neighborhood.nameAr}` : land.sheetLocation ?? '';
    const title = `أرض${land.area != null ? ` ${String(land.area)} م²` : ''}${loc ? ` - ${loc}` : ''}`.trim() || 'أرض';

    const listing = await prisma.listing.create({
      data: {
        sellerId: uid,
        createdById: uid,
        typeOptionId: landType.id,
        title,
        description: land.details ?? null,
        price: land.price,
        contactPhone: sett.alswarey_phone ?? '',
        contactWhatsapp: !!sett.alswarey_whatsapp,
        showOnBrokerage: true,
        ownerId: land.ownerId,
        neighborhoodId: land.neighborhoodId,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    await prisma.attachment.updateMany({ where: { ownerType: 'Land', ownerId: id }, data: { ownerType: 'Listing', ownerId: listing.id } });
    await prisma.land.update({ where: { id }, data: { status: 'PUBLISHED', listingId: listing.id } });
    revalidatePath('/admin/lands/lands');
    return { ok: true, id: listing.id };
  } catch (e) {
    return fail(e);
  }
}

// ── Area maps (location + masterplan; clean original + per-brand stamped copies) ──
export async function setAreaMap(input: {
  level: 'district' | 'neighborhood';
  targetId: string;
  kind: 'location' | 'masterplan';
  attachmentId: string;
}): Promise<Result> {
  await requirePermission('lands', 'UPDATE');
  try {
    const att = await prisma.attachment.findUnique({ where: { id: input.attachmentId } });
    if (!att) return { ok: false, error: 'failed' };
    await prisma.attachment.update({ where: { id: att.id }, data: { ownerType: 'AreaMap', ownerId: input.targetId } });

    const logos = await prisma.setting.findMany({ where: { key: { in: ['brand_alsawarey_logo', 'brand_newobour_logo'] } } });
    const lm = Object.fromEntries(logos.map((s) => [s.key, s.value]));
    const [alswareyPath, newobourPath] = await Promise.all([
      stampMapCopy(att.path, lm['brand_alsawarey_logo'] ?? null),
      stampMapCopy(att.path, lm['brand_newobour_logo'] ?? null),
    ]);

    await prisma.areaMap.upsert({
      where: { level_areaId_kind: { level: input.level, areaId: input.targetId, kind: input.kind } },
      update: { cleanPath: att.path, alswareyPath, newobourPath },
      create: { level: input.level, areaId: input.targetId, kind: input.kind, cleanPath: att.path, alswareyPath, newobourPath },
    });
    revDetail(input.level, input.targetId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function clearAreaMap(input: { level: 'district' | 'neighborhood'; targetId: string; kind: 'location' | 'masterplan' }): Promise<Result> {
  await requirePermission('lands', 'UPDATE');
  try {
    await prisma.areaMap.deleteMany({ where: { level: input.level, areaId: input.targetId, kind: input.kind } });
    revDetail(input.level, input.targetId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ── Notify followers of an update (cascade: area + everything inside it) ──
type FollowSource = { districtId: string | null; neighborhoodId: string | null; blockId: string | null; landId: string | null };

async function followWhere(u: FollowSource): Promise<Record<string, unknown> | null> {
  const or: Record<string, unknown>[] = [];
  if (u.districtId) {
    const nIds = (await prisma.neighborhood.findMany({ where: { districtId: u.districtId }, select: { id: true } })).map((n) => n.id);
    const bIds = nIds.length ? (await prisma.block.findMany({ where: { neighborhoodId: { in: nIds } }, select: { id: true } })).map((b) => b.id) : [];
    const landOr: Record<string, unknown>[] = [];
    if (nIds.length) landOr.push({ neighborhoodId: { in: nIds } });
    if (bIds.length) landOr.push({ blockId: { in: bIds } });
    const lIds = landOr.length ? (await prisma.land.findMany({ where: { OR: landOr }, select: { id: true } })).map((l) => l.id) : [];
    or.push({ districtId: u.districtId });
    if (nIds.length) or.push({ neighborhoodId: { in: nIds } });
    if (bIds.length) or.push({ blockId: { in: bIds } });
    if (lIds.length) or.push({ landId: { in: lIds } });
  } else if (u.neighborhoodId) {
    const bIds = (await prisma.block.findMany({ where: { neighborhoodId: u.neighborhoodId }, select: { id: true } })).map((b) => b.id);
    const landOr: Record<string, unknown>[] = [{ neighborhoodId: u.neighborhoodId }];
    if (bIds.length) landOr.push({ blockId: { in: bIds } });
    const lIds = (await prisma.land.findMany({ where: { OR: landOr }, select: { id: true } })).map((l) => l.id);
    or.push({ neighborhoodId: u.neighborhoodId });
    if (bIds.length) or.push({ blockId: { in: bIds } });
    if (lIds.length) or.push({ landId: { in: lIds } });
  } else if (u.blockId) {
    const lIds = (await prisma.land.findMany({ where: { blockId: u.blockId }, select: { id: true } })).map((l) => l.id);
    or.push({ blockId: u.blockId });
    if (lIds.length) or.push({ landId: { in: lIds } });
  } else if (u.landId) {
    or.push({ landId: u.landId });
  }
  return or.length ? { OR: or } : null;
}

export async function notifyGeoUpdate(id: string): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  await requirePermission('lands', 'UPDATE');
  try {
    const u = await prisma.geoUpdate.findUnique({ where: { id } });
    if (!u) return { ok: false, error: 'failed' };
    const where = await followWhere(u);
    const follows = where ? await prisma.landFollow.findMany({ where: where as never, select: { phone: true } }) : [];
    const phones = [...new Set(follows.map((f) => f.phone).filter(Boolean))];

    await prisma.geoUpdate.update({ where: { id }, data: { notifiedAt: new Date() } });

    if (phones.length) {
      const cfg = await loadSmsConfig();
      const base = (process.env.PORTAL_URL || process.env.NEXTAUTH_URL || '').replace(/\/$/, '');
      const areaId = u.districtId || u.neighborhoodId || u.blockId || u.landId;
      const url = base && areaId ? `${base}/explore/${areaId}` : null;
      const body = `العبور الجديد: ${u.title || 'تحديث جديد عن أرضك'}${url ? ' ' + url : ''}`;
      for (const phone of phones) {
        await sendSms(phone, body, cfg).catch((e) => console.error('geo update sms failed', e));
      }
    }
    revalidatePath('/admin/lands', 'layout');
    return { ok: true, count: phones.length };
  } catch (e) {
    console.error('notifyGeoUpdate failed', e);
    return { ok: false, error: 'failed' };
  }
}

// ── Reciprocal adjacency (both directions written/removed together) ──
export async function setDistrictAdjacency(id: string, neighborIds: string[]): Promise<Result> {
  await requirePermission('lands', 'UPDATE');
  try {
    const next = new Set(neighborIds.filter((x) => x && x !== id));
    const cur = new Set((await prisma.districtLink.findMany({ where: { fromId: id }, select: { toId: true } })).map((c) => c.toId));
    const toAdd = [...next].filter((x) => !cur.has(x));
    const toRemove = [...cur].filter((x) => !next.has(x));
    if (toAdd.length) await prisma.districtLink.createMany({ data: toAdd.flatMap((nb) => [{ fromId: id, toId: nb }, { fromId: nb, toId: id }]), skipDuplicates: true });
    for (const nb of toRemove) await prisma.districtLink.deleteMany({ where: { OR: [{ fromId: id, toId: nb }, { fromId: nb, toId: id }] } });
    revDetail('district', id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function setNeighborhoodAdjacency(id: string, neighborIds: string[]): Promise<Result> {
  await requirePermission('lands', 'UPDATE');
  try {
    const next = new Set(neighborIds.filter((x) => x && x !== id));
    const cur = new Set((await prisma.neighborhoodLink.findMany({ where: { fromId: id }, select: { toId: true } })).map((c) => c.toId));
    const toAdd = [...next].filter((x) => !cur.has(x));
    const toRemove = [...cur].filter((x) => !next.has(x));
    if (toAdd.length) await prisma.neighborhoodLink.createMany({ data: toAdd.flatMap((nb) => [{ fromId: id, toId: nb }, { fromId: nb, toId: id }]), skipDuplicates: true });
    for (const nb of toRemove) await prisma.neighborhoodLink.deleteMany({ where: { OR: [{ fromId: id, toId: nb }, { fromId: nb, toId: id }] } });
    revDetail('neighborhood', id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ── Public-realm amenity types (admin taxonomy) ──
export async function upsertAmenityType(input: { id?: string; titleAr: string; titleEn: string; order?: number; isActive?: boolean }): Promise<Result> {
  await requirePermission('lands', input.id ? 'UPDATE' : 'CREATE');
  try {
    const data = { titleAr: input.titleAr.trim(), titleEn: input.titleEn.trim(), order: input.order ?? 0, isActive: input.isActive ?? true };
    if (!data.titleAr) return { ok: false, error: 'failed' };
    if (input.id) await prisma.amenityType.update({ where: { id: input.id }, data });
    else await prisma.amenityType.create({ data });
    revalidatePath('/admin/lands/amenity-types');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteAmenityType(id: string): Promise<Result> {
  await requirePermission('lands', 'DELETE');
  try {
    await prisma.amenityType.delete({ where: { id } });
    revalidatePath('/admin/lands/amenity-types');
    return { ok: true };
  } catch (e) {
    return fail(e); // P2003 → in_use when amenities still reference it
  }
}

// ── Amenities (per neighborhood; photos via Attachment 'Amenity') ──
export async function upsertAmenity(input: {
  id?: string;
  neighborhoodId: string;
  typeId: string;
  titleAr: string;
  titleEn?: string;
  detailsAr?: string;
  detailsEn?: string;
  order?: number;
  photoIds?: string[];
}): Promise<Result> {
  await requirePermission('lands', input.id ? 'UPDATE' : 'CREATE');
  const session = await auth();
  const uid = session?.user?.id ?? null;
  try {
    const data = {
      typeId: input.typeId,
      titleAr: input.titleAr.trim(),
      titleEn: input.titleEn?.trim() || null,
      detailsAr: input.detailsAr?.trim() || null,
      detailsEn: input.detailsEn?.trim() || null,
      order: input.order ?? 0,
    };
    if (!data.titleAr || !data.typeId) return { ok: false, error: 'failed' };
    let amenityId: string;
    if (input.id) {
      await prisma.amenity.update({ where: { id: input.id }, data });
      amenityId = input.id;
    } else {
      const a = await prisma.amenity.create({ data: { ...data, neighborhoodId: input.neighborhoodId } });
      amenityId = a.id;
    }
    if (input.photoIds && uid) {
      if (input.photoIds.length) await prisma.attachment.updateMany({ where: { id: { in: input.photoIds }, uploaderId: uid }, data: { ownerType: 'Amenity', ownerId: amenityId } });
      await prisma.attachment.updateMany({
        where: { ownerType: 'Amenity', ownerId: amenityId, ...(input.photoIds.length ? { id: { notIn: input.photoIds } } : {}) },
        data: { ownerType: null, ownerId: null },
      });
    }
    revDetail('neighborhood', input.neighborhoodId);
    return { ok: true, id: amenityId };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteAmenity(id: string): Promise<Result> {
  await requirePermission('lands', 'DELETE');
  try {
    await prisma.attachment.updateMany({ where: { ownerType: 'Amenity', ownerId: id }, data: { ownerType: null, ownerId: null } });
    const a = await prisma.amenity.delete({ where: { id } });
    revDetail('neighborhood', a.neighborhoodId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ── Edit an existing update (central Updates section) ──
export async function updateGeoUpdate(input: { id: string; title?: string; body: string; happenedAt?: string }): Promise<Result> {
  await requirePermission('lands', 'UPDATE');
  try {
    const body = input.body?.trim();
    if (!body) return { ok: false, error: 'failed' };
    let happenedAt: Date | undefined;
    if (input.happenedAt) {
      const d = new Date(input.happenedAt);
      if (!isNaN(d.getTime())) happenedAt = d;
    }
    await prisma.geoUpdate.update({ where: { id: input.id }, data: { title: input.title?.trim() || null, body, ...(happenedAt ? { happenedAt } : {}) } });
    revalidatePath('/admin/lands/updates');
    revalidatePath('/admin/lands', 'layout');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
