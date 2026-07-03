'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { sanitizeRichHtml } from '../../../../../lib/sanitize';

type Result = { ok: true; id?: string } | { ok: false; error: string };

const slugify = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, '-').replace(/^-+|-+$/g, '');

export async function saveBuildingCondition(input: {
  id?: string;
  slug: string;
  unitLabelAr: string;
  unitLabelEn?: string;
  titleAr: string;
  titleEn?: string;
  bodyAr?: string;
  bodyEn?: string;
  order?: number;
  published?: boolean;
}): Promise<Result> {
  await requirePermission('guide', input.id ? 'UPDATE' : 'CREATE');
  const slug = slugify(input.slug || input.unitLabelEn || input.titleAr);
  const unitLabelAr = input.unitLabelAr.trim();
  const titleAr = input.titleAr.trim();
  if (!unitLabelAr || !titleAr || !slug) return { ok: false, error: 'required' };
  const data = {
    slug,
    unitLabelAr,
    unitLabelEn: input.unitLabelEn?.trim() || unitLabelAr,
    titleAr,
    titleEn: input.titleEn?.trim() || titleAr,
    bodyAr: sanitizeRichHtml(input.bodyAr),
    bodyEn: sanitizeRichHtml(input.bodyEn),
    order: Number.isFinite(input.order) ? Number(input.order) : 0,
    published: input.published ?? true,
  };
  try {
    let id = input.id;
    if (id) await prisma.buildingCondition.update({ where: { id }, data });
    else id = (await prisma.buildingCondition.create({ data })).id;
    revalidatePath('/admin/guide/conditions');
    revalidatePath('/guide/conditions', 'layout');
    return { ok: true, id };
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === 'P2002') return { ok: false, error: 'duplicate_slug' };
    console.error('saveBuildingCondition failed', e);
    return { ok: false, error: 'failed' };
  }
}

export async function deleteBuildingCondition(id: string): Promise<Result> {
  await requirePermission('guide', 'DELETE');
  try {
    await prisma.buildingCondition.delete({ where: { id } });
    revalidatePath('/admin/guide/conditions');
    return { ok: true };
  } catch (e) {
    console.error('deleteBuildingCondition failed', e);
    return { ok: false, error: 'failed' };
  }
}
