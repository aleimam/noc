import { notFound } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { prisma } from '@noc/db';
import { SiteShell } from '../../_components/SiteShell';

export const dynamic = 'force-dynamic';

export default async function StaticPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const locale = (await getLocale()) as 'ar' | 'en';
  const page = await prisma.page.findUnique({ where: { brand_slug: { brand: 'newobour', slug } } });
  if (!page || !page.published) notFound();

  const title = locale === 'en' ? page.titleEn || page.titleAr : page.titleAr;
  const body = locale === 'en' ? page.bodyEn || page.bodyAr : page.bodyAr;

  return (
    <SiteShell>
      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="mb-6 text-3xl font-black text-navy-800">{title}</h1>
        <div className="page-content leading-relaxed text-ink-800" dangerouslySetInnerHTML={{ __html: body }} />
      </article>
    </SiteShell>
  );
}
