'use server';

import { revalidatePath } from 'next/cache';
import { auth, requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';

type Result = { ok: true } | { ok: false; error: string };
type Cat = 'FACILITIES' | 'ROADS' | 'HANDOVERS' | 'REGULATIONS' | 'GENERAL';

export async function upsertNews(input: {
  id?: string;
  titleAr: string;
  titleEn?: string;
  bodyAr: string;
  bodyEn?: string;
  category: Cat;
  pinned?: boolean;
  published?: boolean;
  photoIds?: string[];
}): Promise<Result> {
  await requirePermission('news', input.id ? 'UPDATE' : 'CREATE');
  const session = await auth();
  const uid = session?.user?.id ?? null;
  if (!input.titleAr.trim() || !input.bodyAr.trim()) return { ok: false, error: 'failed' };

  let publishedAt: Date | null = input.published ? new Date() : null;
  if (input.id && input.published) {
    const ex = await prisma.news.findUnique({ where: { id: input.id }, select: { publishedAt: true } });
    if (ex?.publishedAt) publishedAt = ex.publishedAt; // keep the original publish date on edits
  }
  const data = {
    titleAr: input.titleAr.trim(),
    titleEn: input.titleEn?.trim() || null,
    bodyAr: input.bodyAr.trim(),
    bodyEn: input.bodyEn?.trim() || null,
    category: input.category,
    pinned: !!input.pinned,
    publishedAt,
  };
  try {
    let id = input.id;
    if (id) await prisma.news.update({ where: { id }, data });
    else id = (await prisma.news.create({ data: { ...data, createdById: uid } })).id;

    const ids = input.photoIds ?? [];
    if (ids.length) {
      await prisma.attachment.updateMany({ where: { id: { in: ids }, ...(uid ? { uploaderId: uid } : {}) }, data: { ownerType: 'News', ownerId: id } });
    }
    await prisma.attachment.updateMany({
      where: { ownerType: 'News', ownerId: id, ...(ids.length ? { id: { notIn: ids } } : {}) },
      data: { ownerType: null, ownerId: null },
    });

    revalidatePath('/admin/news');
    revalidatePath('/news');
    return { ok: true };
  } catch {
    return { ok: false, error: 'failed' };
  }
}

export async function deleteNews(id: string): Promise<Result> {
  await requirePermission('news', 'DELETE');
  try {
    await prisma.news.delete({ where: { id } });
    revalidatePath('/admin/news');
    revalidatePath('/news');
    return { ok: true };
  } catch {
    return { ok: false, error: 'failed' };
  }
}
