import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { prisma } from '@noc/db';
import { PhotoGallery, Badge } from '@noc/ui';
import { SiteShell } from '../../_components/SiteShell';
import { pageMeta, breadcrumbLd, ldJson, abs } from '../../../lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const locale = (await getLocale()) as 'ar' | 'en';
  const n = await prisma.news.findUnique({ where: { id } });
  if (!n || !n.publishedAt) return { title: locale === 'en' ? 'News — New Obour' : 'أخبار — العبور الجديد' };
  const title = locale === 'ar' ? n.titleAr : n.titleEn || n.titleAr;
  const body = (locale === 'ar' ? n.bodyAr : n.bodyEn || n.bodyAr) ?? '';
  const cover = await prisma.attachment.findFirst({ where: { ownerType: 'News', ownerId: id }, orderBy: { createdAt: 'asc' }, select: { path: true } });
  return pageMeta({
    title: `${title} — ${locale === 'en' ? 'New Obour' : 'العبور الجديد'}`,
    description: body.replace(/\s+/g, ' ').trim().slice(0, 160),
    path: `/news/${id}`,
    images: cover ? [cover.path] : [],
    type: 'article',
    locale,
  });
}

export default async function NewsDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = (await getLocale()) as 'ar' | 'en';
  const t = await getTranslations('news');
  const L = (ar: string, en: string | null) => (locale === 'ar' ? ar : en || ar);

  const n = await prisma.news.findUnique({ where: { id } });
  if (!n || !n.publishedAt) notFound();
  const photos = await prisma.attachment.findMany({ where: { ownerType: 'News', ownerId: id }, orderBy: { createdAt: 'asc' }, select: { path: true } });
  const fmt = (d: Date) => new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric' }).format(d);

  const title = L(n.titleAr, n.titleEn);
  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: title.slice(0, 110),
    image: photos.map((p) => abs(p.path)),
    datePublished: n.publishedAt.toISOString(),
    dateModified: n.updatedAt.toISOString(),
    inLanguage: locale,
    author: { '@type': 'Organization', name: 'العبور الجديد' },
    publisher: { '@type': 'Organization', name: 'العبور الجديد', logo: { '@type': 'ImageObject', url: abs('/brand/logo') } },
    mainEntityOfPage: abs(`/news/${id}`),
  };
  const crumbsLd = breadcrumbLd([
    { name: L('الرئيسية', 'Home'), path: '/' },
    { name: t('title'), path: '/news' },
    { name: title, path: `/news/${id}` },
  ]);

  return (
    <SiteShell active="news">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson([articleLd, crumbsLd]) }} />
      <article className="mx-auto max-w-[820px] space-y-5 px-6 py-10">
        <a href="/news" className="text-sm text-accent">‹ {t('title')}</a>
        <div className="flex items-center gap-2">
          <Badge tone="navy" size="sm">{t(`cat${n.category}`)}</Badge>
          <span className="text-xs text-ink-400">{fmt(n.publishedAt)}</span>
        </div>
        <h1 className="text-3xl font-extrabold leading-tight text-navy-800">{L(n.titleAr, n.titleEn)}</h1>
        {photos.length > 0 && <PhotoGallery photos={photos.map((p) => p.path)} />}
        <div className="whitespace-pre-wrap leading-relaxed text-ink-700">{L(n.bodyAr, n.bodyEn)}</div>
      </article>
    </SiteShell>
  );
}
