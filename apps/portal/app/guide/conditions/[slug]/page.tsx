import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { prisma } from '@noc/db';
import { SiteShell } from '../../../_components/SiteShell';

export const dynamic = 'force-dynamic';

export default async function ConditionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const locale = (await getLocale()) as 'ar' | 'en';
  const c = await prisma.buildingCondition.findUnique({ where: { slug } });
  if (!c || !c.published) notFound();

  const title = locale === 'en' ? c.titleEn : c.titleAr;
  const body = locale === 'en' ? c.bodyEn || c.bodyAr : c.bodyAr;
  const images = Array.isArray(c.images) ? (c.images as string[]) : [];

  return (
    <SiteShell active="guide">
      <article className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Link href="/guide/conditions" className="text-sm text-navy-600">‹ {locale === 'en' ? 'All conditions' : 'كل الاشتراطات'}</Link>
        <h1 className="mt-3 mb-6 text-3xl font-black text-navy-800 dark:text-soft">{title}</h1>
        <div className="page-content leading-relaxed text-ink-800" dangerouslySetInnerHTML={{ __html: body }} />
        {images.length > 0 && (
          <div className="mt-6 space-y-4">
            {images.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={src} alt="" className="w-full rounded-xl ring-1 ring-ink-200" />
            ))}
          </div>
        )}
      </article>
    </SiteShell>
  );
}
