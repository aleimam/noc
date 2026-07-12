'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { sanitizeRichHtml } from '../../../../lib/sanitize';

type Result = { ok: true; id?: string } | { ok: false; error: string };

const slugify = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, '-').replace(/^-+|-+$/g, '');

export async function savePage(input: {
  id?: string;
  brand: string;
  slug: string;
  titleAr: string;
  titleEn?: string;
  bodyAr?: string;
  bodyEn?: string;
  published?: boolean;
  footerOrder?: number;
}): Promise<Result> {
  await requirePermission('content', input.id ? 'UPDATE' : 'CREATE');
  const brand = input.brand === 'alsawarey' ? 'alsawarey' : 'newobour';
  const slug = slugify(input.slug || input.titleEn || input.titleAr);
  const titleAr = input.titleAr.trim();
  if (!titleAr || !slug) return { ok: false, error: 'required' };
  const data = {
    brand,
    slug,
    titleAr,
    titleEn: input.titleEn?.trim() || null,
    bodyAr: sanitizeRichHtml(input.bodyAr),
    bodyEn: input.bodyEn != null ? sanitizeRichHtml(input.bodyEn) : null,
    published: !!input.published,
    footerOrder: Number.isFinite(input.footerOrder) ? Number(input.footerOrder) : 0,
  };
  try {
    let id = input.id;
    if (id) await prisma.page.update({ where: { id }, data });
    else id = (await prisma.page.create({ data })).id;
    revalidatePath('/admin/pages');
    revalidatePath('/p/' + slug, 'layout');
    return { ok: true, id };
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === 'P2002') return { ok: false, error: 'duplicate_slug' };
    console.error('savePage failed', e);
    return { ok: false, error: 'failed' };
  }
}

export async function deletePage(id: string): Promise<Result> {
  await requirePermission('content', 'DELETE');
  try {
    await prisma.page.delete({ where: { id } });
    revalidatePath('/admin/pages');
    return { ok: true };
  } catch (e) {
    console.error('deletePage failed', e);
    return { ok: false, error: 'failed' };
  }
}
