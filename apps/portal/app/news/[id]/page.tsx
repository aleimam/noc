import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { prisma } from '@noc/db';
import { PublicShell, PhotoGallery, Badge } from '@noc/ui';

export const dynamic = 'force-dynamic';

export default async function NewsDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = (await getLocale()) as 'ar' | 'en';
  const t = await getTranslations('news');
  const L = (ar: string, en: string | null) => (locale === 'ar' ? ar : en || ar);

  const n = await prisma.news.findUnique({ where: { id } });
  if (!n || !n.publishedAt) notFound();
  const photos = await prisma.attachment.findMany({ where: { ownerType: 'News', ownerId: id }, orderBy: { createdAt: 'asc' }, select: { path: true } });
  const fmt = (d: Date) => new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric' }).format(d);

  return (
    <PublicShell active="news">
      <article className="mx-auto max-w-[820px] space-y-5 px-6 py-10">
        <a href="/news" className="text-sm text-accent">← {t('title')}</a>
        <div className="flex items-center gap-2">
          <Badge tone="navy" size="sm">{t(`cat${n.category}`)}</Badge>
          <span className="text-xs text-ink-400">{fmt(n.publishedAt)}</span>
        </div>
        <h1 className="text-3xl font-extrabold leading-tight text-navy-800">{L(n.titleAr, n.titleEn)}</h1>
        {photos.length > 0 && <PhotoGallery photos={photos.map((p) => p.path)} />}
        <div className="whitespace-pre-wrap leading-relaxed text-ink-700">{L(n.bodyAr, n.bodyEn)}</div>
      </article>
    </PublicShell>
  );
}
