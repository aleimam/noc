'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { auth, requirePermission, loadSmsConfig } from '@noc/auth';
import { prisma, Prisma } from '@noc/db';
import { sendSms } from '@noc/sms';
import { stampMapCopy } from '../../../../lib/mapStamp';
import { cityHref, districtHref, neighborhoodHref } from '../../../../lib/geoHref';
import { pingIndexNow, portalOrigin } from '../../../../lib/indexnow';
import { sanitizeRichHtml } from '../../../../lib/sanitize';
import { seoIntroSettingKey } from '../../../../lib/seoContent';
import { markAreaListingsStale } from '../../../../lib/poster/generate';
import {
  defaultGeoInheritance,
  GEO_INHERITANCE_KEY,
  GEO_INHERIT_CATEGORIES,
  GEO_INHERIT_TRANSITIONS,
  type GeoInheritanceMatrix,
} from '../../../../lib/geoInheritance';

type GeoLevel = 'city' | 'district' | 'neighborhood' | 'block' | 'land';
function revDetail(level: GeoLevel, id: string) {
  if (level === 'city') {
    revalidatePath(`/admin/lands/cities/${id}`);
    revalidatePath(`/admin/lands/cities/${id}/edit`);
    // Public geo pages use key/slug params — invalidate the whole dynamic segment.
    revalidatePath('/explore/city/[id]', 'page');
  } else if (level === 'district') {
    revalidatePath(`/admin/lands/districts/${id}`);
    revalidatePath(`/admin/lands/districts/${id}/edit`);
    revalidatePath('/explore/district/[id]', 'page');
  } else if (level === 'neighborhood') {
    revalidatePath(`/admin/lands/neighborhoods/${id}`);
    revalidatePath(`/admin/lands/neighborhoods/${id}/edit`);
    revalidatePath('/explore/neighborhood/[id]', 'page');
  }
}
/** Absolute canonical /explore URL for a geo-update target — null for block/land
 *  (no public page of their own) or a missing row. Used for IndexNow pings. */
async function geoUpdateUrl(level: GeoLevel, targetId: string): Promise<string | null> {
  if (level === 'city') {
    const c = await prisma.city.findUnique({ where: { id: targetId }, select: { id: true, key: true } });
    return c ? portalOrigin() + cityHref(c) : null;
  }
  if (level === 'district') {
    const d = await prisma.district.findUnique({ where: { id: targetId }, select: { id: true, key: true } });
    return d ? portalOrigin() + districtHref(d) : null;
  }
  if (level === 'neighborhood') {
    const n = await prisma.neighborhood.findUnique({ where: { id: targetId }, select: { id: true, nameAr: true, district: { select: { nameAr: true } } } });
    return n ? portalOrigin() + neighborhoodHref(n) : null;
  }
  return null;
}

function geoField(level: GeoLevel, id: string) {
  return level === 'city'
    ? { cityId: id }
    : level === 'district'
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

// ── Cities (top of the geo hierarchy: City → District → Neighborhood) ──
export async function upsertCity(input: {
  id?: string;
  key?: string; // create only; auto-generated when omitted (name-prompt create flow)
  nameAr: string;
  nameEn: string;
  order?: number;
  isActive?: boolean;
}): Promise<Result> {
  await requirePermission('lands', input.id ? 'UPDATE' : 'CREATE');
  try {
    const data = { nameAr: input.nameAr.trim(), nameEn: input.nameEn.trim(), order: input.order ?? 0, isActive: input.isActive ?? true };
    if (!data.nameAr) return { ok: false, error: 'failed' };
    const row = input.id
      ? await prisma.city.update({ where: { id: input.id }, data })
      : await prisma.city.create({ data: { ...data, key: input.key?.trim() || `city-${randomUUID().slice(0, 8)}` } });
    rev();
    revalidatePath('/admin/lands/cities');
    return { ok: true, id: row.id };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteCity(id: string): Promise<Result> {
  await requirePermission('lands', 'DELETE');
  try {
    // Districts are detached (cityId → NULL via FK); city advantages cascade away.
    await prisma.city.delete({ where: { id } });
    rev();
    revalidatePath('/admin/lands/cities');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ── Districts ──
export async function upsertDistrict(input: {
  id?: string;
  key?: string; // create only; auto-generated when omitted
  cityId?: string | null; // parent city (editable from the Basics section)
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
      ...(input.cityId !== undefined ? { cityId: input.cityId || null } : {}),
    };
    if (!data.nameAr) return { ok: false, error: 'failed' };
    const row = input.id
      ? await prisma.district.update({ where: { id: input.id }, data })
      : await prisma.district.create({ data: { ...data, key: input.key?.trim() || `district-${randomUUID().slice(0, 8)}` } });
    rev();
    revalidatePath('/admin/lands/districts');
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
    // Quick numbered add: a BARE number (ASCII or Arabic-Indic ٠-٩ / Persian ۰-۹) becomes
    // «مجاورة N» / «Neighborhood N» and sets order = N, so numbered neighborhoods sort naturally.
    // A full name is kept as-is; when its order is left 0 we still derive it from any number in
    // the name. This is the single source of truth (the form just passes what was typed).
    const toLatin = (s: string) =>
      s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
    let nameAr = input.nameAr.trim();
    let nameEn = input.nameEn.trim();
    let order = input.order ?? 0;
    const bare = toLatin(nameAr).replace(/\s+/g, '');
    if (/^\d+$/.test(bare)) {
      const n = Number(bare);
      nameAr = `مجاورة ${n}`;
      if (!nameEn) nameEn = `Neighborhood ${n}`;
      if (!order) order = n;
    } else if (!order) {
      const m = /(\d+)/.exec(toLatin(nameAr));
      if (m) order = Number(m[1]);
    }

    // No duplicate neighborhoods within the same district: reject a sibling with the same
    // Arabic OR English name (case- + whitespace-insensitive), excluding the row being edited.
    // Runs AFTER the numbered-add expansion so re-adding «2» (→ «مجاورة 2») is also caught.
    const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
    const nA = norm(nameAr);
    const nE = norm(nameEn);
    const siblings = await prisma.neighborhood.findMany({
      where: { districtId: input.districtId, ...(input.id ? { id: { not: input.id } } : {}) },
      select: { nameAr: true, nameEn: true },
    });
    if (siblings.some((s) => norm(s.nameAr) === nA || (!!nE && norm(s.nameEn) === nE))) {
      return { ok: false, error: 'duplicate' };
    }

    const data = {
      districtId: input.districtId,
      nameAr,
      nameEn,
      hasBlocks: !!input.hasBlocks,
      assortedAreas: !!input.assortedAreas,
      areas: input.areas ?? [],
      buildingTypes: input.buildingTypes ?? [],
      mainRoads: input.mainRoads ?? [],
      order, // derived above (numbered add / number-in-name); falls back to input.order
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

/** Focused update of a neighborhood's available standard plot areas (المساحات المتاحة) —
 *  used by the AreasEditor on the neighborhood edit page. `assorted` = «مساحات متنوعة». */
export async function updateNeighborhoodAreas(id: string, areas: number[], assorted: boolean): Promise<Result> {
  await requirePermission('lands', 'UPDATE');
  try {
    const clean = Array.from(new Set(areas.filter((a) => Number.isFinite(a) && a > 0).map((a) => Math.round(a)))).sort((a, b) => a - b);
    await prisma.neighborhood.update({ where: { id }, data: { areas: clean, assortedAreas: !!assorted } });
    rev();
    return { ok: true, id };
  } catch (e) {
    return fail(e);
  }
}

/** Auto-save for the shared "Basics" section on every geo edit page (name / parent / order /
 *  active, + building types & main roads for a neighborhood). Dispatches to the level's upsert
 *  so all its guards run (neighborhood: dup-name check + numbered-name expansion). Areas/assorted
 *  are owned by the AreasEditor, so we reload + preserve them rather than overwrite. */
export async function saveGeoBasics(input: {
  level: 'city' | 'district' | 'neighborhood';
  id: string;
  nameAr: string;
  nameEn: string;
  order?: number;
  isActive?: boolean;
  parentId?: string | null; // district → city, neighborhood → district
  buildingTypes?: string[]; // neighborhood only
  mainRoads?: string[]; // neighborhood only
}): Promise<Result> {
  await requirePermission('lands', 'UPDATE');
  if (input.level === 'city') {
    return upsertCity({ id: input.id, nameAr: input.nameAr, nameEn: input.nameEn, order: input.order, isActive: input.isActive });
  }
  if (input.level === 'district') {
    return upsertDistrict({ id: input.id, cityId: input.parentId ?? null, nameAr: input.nameAr, nameEn: input.nameEn, order: input.order, isActive: input.isActive });
  }
  if (!input.parentId) return { ok: false, error: 'district_required' };
  const cur = await prisma.neighborhood.findUnique({ where: { id: input.id }, select: { areas: true, assortedAreas: true } });
  return upsertNeighborhood({
    id: input.id,
    districtId: input.parentId,
    nameAr: input.nameAr,
    nameEn: input.nameEn,
    order: input.order,
    isActive: input.isActive,
    areas: (cur?.areas as number[] | null) ?? [],
    assortedAreas: cur?.assortedAreas ?? false,
    buildingTypes: input.buildingTypes ?? [],
    mainRoads: input.mainRoads ?? [],
  });
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
    const body = sanitizeRichHtml(input.body);
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
    // IndexNow: the update surfaces on the target's public explore page — fire-and-forget.
    void geoUpdateUrl(input.level, input.targetId)
      .then((url) => (url ? pingIndexNow([url]) : undefined))
      .catch((e) => console.warn('indexnow geo ping failed', e));
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
    revalidatePath('/explore', 'layout');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ── Advantages (bilingual, per district or neighborhood) ──
export async function upsertAdvantage(input: {
  id?: string;
  level: 'city' | 'district' | 'neighborhood';
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
    await markAreaListingsStale(input.level, input.targetId); // advantages feed listing images
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteAdvantage(id: string): Promise<Result> {
  await requirePermission('lands', 'DELETE');
  try {
    const a = await prisma.advantage.findUnique({ where: { id }, select: { cityId: true, districtId: true, neighborhoodId: true } });
    await prisma.advantage.delete({ where: { id } });
    if (a?.cityId) await markAreaListingsStale('city', a.cityId);
    else if (a?.districtId) await markAreaListingsStale('district', a.districtId);
    else if (a?.neighborhoodId) await markAreaListingsStale('neighborhood', a.neighborhoodId);
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

// ── Area maps (city / district / neighborhood / listing × location / masterplan / services /
// mainroads). Clean original + per-brand stamped copies. A location map can also carry
// editable annotator shapes + the source (parent masterplan) path it was drawn on, so it
// can be re-tweaked later. ──
type MapLevel = 'city' | 'district' | 'neighborhood' | 'listing';
type MapKind = 'location' | 'masterplan' | 'services' | 'mainroads';

function revMap(level: MapLevel, id: string) {
  if (level === 'listing') {
    revalidatePath(`/admin/marketplace/listings/${id}/edit`);
    revalidatePath(`/market/${id}`);
    revalidatePath(`/listings/${id}`);
  } else {
    revDetail(level, id);
  }
}

// Shared: dual-brand-stamp an uploaded image and upsert its AreaMap row (one `kind`).
// Used by both the 4 fixed maps (setAreaMap) and arbitrary custom photos (addCustomAreaPhoto).
async function stampAndUpsertAreaMap(input: {
  level: MapLevel;
  targetId: string;
  kind: string;
  attachmentId: string;
  title?: string | null;
  annotation?: unknown; // editable annotator shapes (location maps)
  sourcePath?: string | null; // parent masterplan the location was annotated on
}): Promise<Result> {
  const att = await prisma.attachment.findUnique({ where: { id: input.attachmentId } });
  if (!att) return { ok: false, error: 'failed' };
  await prisma.attachment.update({ where: { id: att.id }, data: { ownerType: 'AreaMap', ownerId: input.targetId } });

  // Two independent per-site copies (each resolves its own logo: watermark-page override, else
  // that site's brand logo). 'map' = Al Sawarey copy, 'map-newobour' = New Obour copy.
  const [alswareyPath, newobourPath] = await Promise.all([
    stampMapCopy(att.path, 'map'),
    stampMapCopy(att.path, 'map-newobour'),
  ]);

  const annPatch = input.annotation === undefined ? {} : { annotation: (input.annotation ?? Prisma.JsonNull) as Prisma.InputJsonValue };
  const srcPatch = input.sourcePath === undefined ? {} : { sourcePath: input.sourcePath };
  const titlePatch = input.title === undefined ? {} : { title: input.title?.trim() || null };

  await prisma.areaMap.upsert({
    where: { level_areaId_kind: { level: input.level, areaId: input.targetId, kind: input.kind } },
    update: { cleanPath: att.path, alswareyPath, newobourPath, ...annPatch, ...srcPatch, ...titlePatch },
    create: {
      level: input.level,
      areaId: input.targetId,
      kind: input.kind,
      title: input.title?.trim() || null,
      cleanPath: att.path,
      alswareyPath,
      newobourPath,
      annotation: (input.annotation ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      sourcePath: input.sourcePath ?? null,
    },
  });
  if (input.level === 'listing') await prisma.listing.update({ where: { id: input.targetId }, data: { postersStale: true } }).catch(() => {});
  revMap(input.level, input.targetId);
  return { ok: true };
}

export async function setAreaMap(input: {
  level: MapLevel;
  targetId: string;
  kind: string; // MapKind for the 4 fixed slots; 'custom:<id>' via addCustomAreaPhoto
  attachmentId: string;
  title?: string | null; // editable heading (persisted on the row)
  annotation?: unknown; // editable annotator shapes (location maps)
  sourcePath?: string | null; // parent masterplan the location was annotated on
}): Promise<Result> {
  await requirePermission(input.level === 'listing' ? 'listings' : 'lands', 'UPDATE');
  try {
    return await stampAndUpsertAreaMap(input);
  } catch (e) {
    return fail(e);
  }
}

/** Rename a map (fixed or custom) without re-uploading — title only. */
export async function setAreaMapTitle(input: { level: MapLevel; targetId: string; kind: string; title: string | null }): Promise<Result> {
  await requirePermission(input.level === 'listing' ? 'listings' : 'lands', 'UPDATE');
  try {
    await prisma.areaMap.updateMany({
      where: { level: input.level, areaId: input.targetId, kind: input.kind },
      data: { title: input.title?.trim() || null },
    });
    revMap(input.level, input.targetId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Add one arbitrary branded area photo (stored as an extra AreaMap row, unique `custom:` kind).
 *  Behaves exactly like a map: dual-brand stamped + inheritable per the 'maps' matrix. */
export async function addCustomAreaPhoto(input: {
  level: MapLevel;
  targetId: string;
  attachmentId: string;
  title?: string | null;
}): Promise<Result> {
  await requirePermission(input.level === 'listing' ? 'listings' : 'lands', 'UPDATE');
  try {
    const kind = `custom:${randomUUID()}`;
    const r = await stampAndUpsertAreaMap({ level: input.level, targetId: input.targetId, kind, attachmentId: input.attachmentId, title: input.title });
    return r.ok ? { ok: true, id: kind } : r;
  } catch (e) {
    return fail(e);
  }
}

// Delete a custom area photo = clear its AreaMap row by kind (reuses clearAreaMap).
export async function clearAreaMap(input: { level: MapLevel; targetId: string; kind: string }): Promise<Result> {
  await requirePermission(input.level === 'listing' ? 'listings' : 'lands', 'UPDATE');
  try {
    await prisma.areaMap.deleteMany({ where: { level: input.level, areaId: input.targetId, kind: input.kind } });
    if (input.level === 'listing') await prisma.listing.update({ where: { id: input.targetId }, data: { postersStale: true } }).catch(() => {});
    revMap(input.level, input.targetId);
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
    // City-level updates: LandFollow has no cityId (no city follows exist) → the SMS step is skipped.
    const where = u.cityId ? null : await followWhere(u);
    const follows = where ? await prisma.landFollow.findMany({ where: where as never, select: { phone: true } }) : [];
    const phones = [...new Set(follows.map((f) => f.phone).filter(Boolean))];

    await prisma.geoUpdate.update({ where: { id }, data: { notifiedAt: new Date() } });

    if (phones.length) {
      const cfg = await loadSmsConfig();
      const base = (process.env.PORTAL_URL || process.env.NEXTAUTH_URL || '').replace(/\/$/, '');
      // Canonical SEO URL for the SMS link (district key / neighborhood slug). Block- and
      // land-level updates have no public page — those SMSes go out without a link.
      let url: string | null = null;
      if (base) {
        if (u.districtId) {
          const d = await prisma.district.findUnique({ where: { id: u.districtId }, select: { id: true, key: true } });
          if (d) url = `${base}${districtHref(d)}`;
        } else if (u.neighborhoodId) {
          const n = await prisma.neighborhood.findUnique({
            where: { id: u.neighborhoodId },
            select: { id: true, nameAr: true, district: { select: { nameAr: true } } },
          });
          if (n) url = `${base}${neighborhoodHref(n)}`;
        }
      }
      const body = `العبور الجديدة: ${u.title || 'تحديث جديد عن أرضك'}${url ? ' ' + url : ''}`;
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

// ── Amenity categories: a Shared Option List (find-or-create, id pinned in Settings) ──
const AMENITY_CATEGORY_LIST_KEY = 'amenity.categoryListId';

/** Returns the id of the "Amenity categories" Shared Option List, creating it on first use. */
export async function getAmenityCategoryListId(): Promise<string> {
  const row = await prisma.setting.findUnique({ where: { key: AMENITY_CATEGORY_LIST_KEY } });
  if (row?.value) {
    const exists = await prisma.optionList.findUnique({ where: { id: row.value }, select: { id: true } });
    if (exists) return exists.id;
  }
  const list = await prisma.optionList.create({ data: { name: 'أنواع المرافق / Amenity categories' } });
  await prisma.setting.upsert({ where: { key: AMENITY_CATEGORY_LIST_KEY }, update: { value: list.id }, create: { key: AMENITY_CATEGORY_LIST_KEY, value: list.id } });
  return list.id;
}

// ── Global amenity library (built once; photos via Attachment 'Amenity') ──
export async function upsertAmenity(input: {
  id?: string;
  categoryItemId?: string | null;
  titleAr: string;
  titleEn?: string;
  detailsAr?: string;
  detailsEn?: string;
  order?: number;
  isActive?: boolean;
  photoIds?: string[];
}): Promise<Result> {
  await requirePermission('lands', input.id ? 'UPDATE' : 'CREATE');
  const session = await auth();
  const uid = session?.user?.id ?? null;
  try {
    const data = {
      categoryItemId: input.categoryItemId || null,
      titleAr: input.titleAr.trim(),
      titleEn: input.titleEn?.trim() || null,
      detailsAr: input.detailsAr?.trim() || null,
      detailsEn: input.detailsEn?.trim() || null,
      order: input.order ?? 0,
      isActive: input.isActive ?? true,
    };
    if (!data.titleAr) return { ok: false, error: 'failed' };
    let amenityId: string;
    if (input.id) {
      await prisma.amenity.update({ where: { id: input.id }, data });
      amenityId = input.id;
    } else {
      const a = await prisma.amenity.create({ data });
      amenityId = a.id;
    }
    if (input.photoIds && uid) {
      if (input.photoIds.length) await prisma.attachment.updateMany({ where: { id: { in: input.photoIds }, uploaderId: uid }, data: { ownerType: 'Amenity', ownerId: amenityId } });
      await prisma.attachment.updateMany({
        where: { ownerType: 'Amenity', ownerId: amenityId, ...(input.photoIds.length ? { id: { notIn: input.photoIds } } : {}) },
        data: { ownerType: null, ownerId: null },
      });
    }
    revalidatePath('/admin/lands/amenities');
    return { ok: true, id: amenityId };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteAmenity(id: string): Promise<Result> {
  await requirePermission('lands', 'DELETE');
  try {
    await prisma.attachment.updateMany({ where: { ownerType: 'Amenity', ownerId: id }, data: { ownerType: null, ownerId: null } });
    await prisma.amenity.delete({ where: { id } }); // placements cascade
    revalidatePath('/admin/lands/amenities');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ── Attach/detach library amenities to a place (neighborhood / district / listing) ──
export async function setAmenityPlacements(
  scope: 'neighborhood' | 'district' | 'listing',
  scopeId: string,
  amenityIds: string[],
): Promise<Result> {
  await requirePermission('lands', 'UPDATE');
  try {
    const where =
      scope === 'neighborhood' ? { neighborhoodId: scopeId } : scope === 'district' ? { districtId: scopeId } : { listingId: scopeId };
    const existing = await prisma.amenityPlacement.findMany({ where, select: { id: true, amenityId: true } });
    const want = new Set(amenityIds);
    const have = new Set(existing.map((e) => e.amenityId));
    const toDelete = existing.filter((e) => !want.has(e.amenityId)).map((e) => e.id);
    const toAdd = amenityIds.filter((a) => !have.has(a));
    if (toDelete.length) await prisma.amenityPlacement.deleteMany({ where: { id: { in: toDelete } } });
    if (toAdd.length) await prisma.amenityPlacement.createMany({ data: toAdd.map((amenityId) => ({ amenityId, ...where })) });
    if (scope === 'neighborhood') revDetail('neighborhood', scopeId);
    else if (scope === 'district') revDetail('district', scopeId);
    else revalidatePath(`/admin/marketplace/listings/${scopeId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ── Edit an existing update (central Updates section) ──
export async function updateGeoUpdate(input: { id: string; title?: string; body: string; happenedAt?: string }): Promise<Result> {
  await requirePermission('lands', 'UPDATE');
  try {
    const body = sanitizeRichHtml(input.body);
    if (!body) return { ok: false, error: 'failed' };
    let happenedAt: Date | undefined;
    if (input.happenedAt) {
      const d = new Date(input.happenedAt);
      if (!isNaN(d.getTime())) happenedAt = d;
    }
    const u = await prisma.geoUpdate.update({
      where: { id: input.id },
      data: { title: input.title?.trim() || null, body, ...(happenedAt ? { happenedAt } : {}) },
      select: { cityId: true, districtId: true, neighborhoodId: true },
    });
    revalidatePath('/admin/lands/updates');
    revalidatePath('/admin/lands', 'layout');
    revalidatePath('/explore', 'layout');
    // IndexNow: re-announce the target's public explore page (city/district/neighborhood only).
    const level: GeoLevel | null = u.cityId ? 'city' : u.districtId ? 'district' : u.neighborhoodId ? 'neighborhood' : null;
    const targetId = u.cityId ?? u.districtId ?? u.neighborhoodId;
    if (level && targetId) {
      void geoUpdateUrl(level, targetId)
        .then((url) => (url ? pingIndexNow([url]) : undefined))
        .catch((e) => console.warn('indexnow geo ping failed', e));
    }
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ── Geo inheritance matrix (which content flows City→District→Neighborhood→Listing) ──
export async function saveGeoInheritance(input: GeoInheritanceMatrix): Promise<Result> {
  await requirePermission('lands', 'UPDATE');
  try {
    // Sanitize: only known category/transition keys, booleans only, over all-on defaults.
    const clean = defaultGeoInheritance();
    for (const c of GEO_INHERIT_CATEGORIES) {
      for (const tr of GEO_INHERIT_TRANSITIONS) {
        const v = input?.[c]?.[tr];
        if (typeof v === 'boolean') clean[c][tr] = v;
      }
    }
    const value = JSON.stringify(clean);
    await prisma.setting.upsert({ where: { key: GEO_INHERITANCE_KEY }, update: { value }, create: { key: GEO_INHERITANCE_KEY, value } });
    revalidatePath('/admin/lands');
    revalidatePath('/explore', 'layout');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Save the per-city / per-district SEO intro paragraph (Setting seo.intro.<level>.<id>).
 *  Permission 'lands' (edited inline on the geo editor). Rendered as plain text publicly. */
export async function saveGeoSeoIntro(
  level: 'city' | 'district',
  id: string,
  value: { ar: string; en: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requirePermission('lands', 'UPDATE');
  const clean = { ar: (value.ar ?? '').trim(), en: (value.en ?? '').trim() };
  try {
    const key = seoIntroSettingKey(`${level}.${id}`);
    await prisma.setting.upsert({ where: { key }, update: { value: JSON.stringify(clean) }, create: { key, value: JSON.stringify(clean) } });
    revDetail(level, id);
    return { ok: true };
  } catch (e) {
    console.error('saveGeoSeoIntro failed', e);
    return { ok: false, error: 'failed' };
  }
}
