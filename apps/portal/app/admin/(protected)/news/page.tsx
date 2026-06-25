import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { NewsManager } from './NewsManager';

export const dynamic = 'force-dynamic';

export default async function AdminNewsPage() {
  await requirePermission('news', 'VIEW');
  const t = await getTranslations('news');
  const rows = await prisma.news.findMany({ orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }], take: 200 });
  const ids = rows.map((r) => r.id);
  const atts = ids.length
    ? await prisma.attachment.findMany({ where: { ownerType: 'News', ownerId: { in: ids } }, orderBy: { createdAt: 'asc' }, select: { id: true, path: true, originalName: true, ownerId: true } })
    : [];
  const byNews = new Map<string, { id: string; path: string; originalName: string }[]>();
  for (const a of atts) {
    if (!a.ownerId) continue;
    (byNews.get(a.ownerId) ?? byNews.set(a.ownerId, []).get(a.ownerId)!).push({ id: a.id, path: a.path, originalName: a.originalName });
  }
  const initial = rows.map((r) => ({
    id: r.id,
    titleAr: r.titleAr,
    titleEn: r.titleEn ?? '',
    bodyAr: r.bodyAr,
    bodyEn: r.bodyEn ?? '',
    category: r.category,
    pinned: r.pinned,
    published: !!r.publishedAt,
    photos: byNews.get(r.id) ?? [],
  }));
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('title')}</h1>
      </div>
      <NewsManager initial={initial} />
    </div>
  );
}
