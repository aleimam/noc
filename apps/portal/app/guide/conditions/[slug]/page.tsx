import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { prisma } from '@noc/db';
import { PhotoGallery } from '@noc/ui';
import { pick } from '@noc/i18n';
import { SiteShell } from '../../../_components/SiteShell';
import { pageMeta, breadcrumbLd, ldJson, abs } from '../../../../lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const locale = (await getLocale()) as 'ar' | 'en';
  const c = await prisma.buildingCondition.findUnique({ where: { slug } });
  if (!c || !c.published) return { title: locale === 'en' ? 'Building conditions — New Obour' : 'اشتراطات البناء — العبور الجديدة' };
  const title = pick(c.titleAr, c.titleEn, locale);
  const body = pick(c.bodyAr, c.bodyEn, locale).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const imgs = Array.isArray(c.images) ? (c.images as string[]) : [];
  return pageMeta({
    title: `${title} — ${locale === 'en' ? 'New Obour' : 'العبور الجديدة'}`,
    description: body.slice(0, 160),
    path: `/guide/conditions/${slug}`,
    images: imgs.slice(0, 1),
    type: 'article',
    locale,
  });
}

export default async function ConditionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const locale = (await getLocale()) as 'ar' | 'en';
  const c = await prisma.buildingCondition.findUnique({ where: { slug } });
  if (!c || !c.published) notFound();

  const title = pick(c.titleAr, c.titleEn, locale);
  const body = pick(c.bodyAr, c.bodyEn, locale);
  const images = Array.isArray(c.images) ? (c.images as string[]) : [];

  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title.slice(0, 110),
    image: images.map((i) => abs(i)),
    dateModified: c.updatedAt.toISOString(),
    inLanguage: locale,
    author: { '@type': 'Organization', name: 'العبور الجديدة' },
    publisher: { '@type': 'Organization', name: 'العبور الجديدة', logo: { '@type': 'ImageObject', url: abs('/brand/logo') } },
    mainEntityOfPage: abs(`/guide/conditions/${slug}`),
  };
  const crumbsLd = breadcrumbLd([
    { name: locale === 'en' ? 'Home' : 'الرئيسية', path: '/' },
    { name: locale === 'en' ? 'Guide' : 'الدليل', path: '/guide' },
    { name: locale === 'en' ? 'Building conditions' : 'اشتراطات البناء', path: '/guide/conditions' },
    { name: title, path: `/guide/conditions/${slug}` },
  ]);

  return (
    <SiteShell active="guide">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson([articleLd, crumbsLd]) }} />
      <article className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Link href="/guide/conditions" className="text-sm text-navy-600">‹ {locale === 'en' ? 'All conditions' : 'كل الاشتراطات'}</Link>
        <h1 className="mt-3 mb-6 text-3xl font-black text-navy-800 dark:text-soft">{title}</h1>
        <div className="page-content leading-relaxed text-ink-800" dangerouslySetInnerHTML={{ __html: body }} />
        {images.length > 0 && (
          <div className="mt-8 space-y-3">
            <h2 className="text-xl font-bold text-navy-800 dark:text-soft">{locale === 'en' ? 'Official sheet' : 'الكشف الرسمي'}</h2>
            <PhotoGallery photos={images} alt={`${title} — ${locale === 'en' ? 'Official sheet' : 'الكشف الرسمي'}`} locale={locale} />
          </div>
        )}
      </article>
    </SiteShell>
  );
}
