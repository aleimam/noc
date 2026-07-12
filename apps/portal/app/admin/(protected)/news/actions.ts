'use server';

import { revalidatePath } from 'next/cache';
import { auth, requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { pingIndexNow, portalOrigin } from '../../../../lib/indexnow';
import { sanitizeRichHtml } from '../../../../lib/sanitize';

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
  await requirePermission('content', input.id ? 'UPDATE' : 'CREATE');
  const session = await auth();
  const uid = session?.user?.id ?? null;
  if (!input.titleAr.trim() || !input.bodyAr.trim()) return { ok: false, error: 'failed' };

  let publishedAt: Date | null = input.published ? new Date() : null;
  let wasPublished = false;
  if (input.id && input.published) {
    const ex = await prisma.news.findUnique({ where: { id: input.id }, select: { publishedAt: true } });
    if (ex?.publishedAt) { publishedAt = ex.publishedAt; wasPublished = true; } // keep the original publish date on edits
  }
  const data = {
    titleAr: input.titleAr.trim(),
    titleEn: input.titleEn?.trim() || null,
    bodyAr: sanitizeRichHtml(input.bodyAr),
    bodyEn: input.bodyEn ? sanitizeRichHtml(input.bodyEn) : null,
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
    // IndexNow: only on first publish (not on edits of already-published items).
    if (input.published && !wasPublished) {
      void pingIndexNow([`${portalOrigin()}/news`, `${portalOrigin()}/news/${id}`]).catch((e) => console.warn('indexnow news ping failed', e));
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'failed' };
  }
}

export async function deleteNews(id: string): Promise<Result> {
  await requirePermission('content', 'DELETE');
  try {
    await prisma.news.delete({ where: { id } });
    revalidatePath('/admin/news');
    revalidatePath('/news');
    return { ok: true };
  } catch {
    return { ok: false, error: 'failed' };
  }
}
