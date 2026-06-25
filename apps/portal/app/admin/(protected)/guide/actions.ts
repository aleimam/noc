'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';

type Result = { ok: true } | { ok: false; error: string };
type Sec = 'LICENSING' | 'HANDOVER' | 'COMPANIES' | 'COSTS';

export async function upsertGuideEntry(input: {
  id?: string;
  section: Sec;
  titleAr: string;
  titleEn?: string;
  bodyAr: string;
  bodyEn?: string;
  order?: number;
  isActive?: boolean;
}): Promise<Result> {
  await requirePermission('guide', input.id ? 'UPDATE' : 'CREATE');
  if (!input.titleAr.trim() || !input.bodyAr.trim()) return { ok: false, error: 'failed' };
  const data = {
    section: input.section,
    titleAr: input.titleAr.trim(),
    titleEn: input.titleEn?.trim() || null,
    bodyAr: input.bodyAr.trim(),
    bodyEn: input.bodyEn?.trim() || null,
    order: input.order ?? 0,
    isActive: input.isActive ?? true,
  };
  try {
    if (input.id) await prisma.guideEntry.update({ where: { id: input.id }, data });
    else await prisma.guideEntry.create({ data });
    revalidatePath('/admin/guide');
    revalidatePath('/guide');
    return { ok: true };
  } catch {
    return { ok: false, error: 'failed' };
  }
}

export async function deleteGuideEntry(id: string): Promise<Result> {
  await requirePermission('guide', 'DELETE');
  try {
    await prisma.guideEntry.delete({ where: { id } });
    revalidatePath('/admin/guide');
    revalidatePath('/guide');
    return { ok: true };
  } catch {
    return { ok: false, error: 'failed' };
  }
}
