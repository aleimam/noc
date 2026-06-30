import { getLocale, getTranslations } from 'next-intl/server';
import { prisma } from '@noc/db';
import { Badge } from '@noc/ui';
import { SiteShell } from '../_components/SiteShell';

export const dynamic = 'force-dynamic';

export default async function NewsPage() {
  const locale = (await getLocale()) as 'ar' | 'en';
  const t = await getTranslations('news');
  const L = (ar: string, en: string | null) => (locale === 'ar' ? ar : en || ar);
  const fmt = (d: Date | null) => (d ? new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric' }).format(d) : '');

  const rows = await prisma.news.findMany({ where: { publishedAt: { not: null } }, orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }], take: 50 });
  const ids = rows.map((r) => r.id);
  const covers = ids.length ? await prisma.attachment.findMany({ where: { ownerType: 'News', ownerId: { in: ids } }, orderBy: { createdAt: 'asc' }, select: { ownerId: true, path: true } }) : [];
  const cover = new Map<string, string>();
  for (const c of covers) if (c.ownerId && !cover.has(c.ownerId)) cover.set(c.ownerId, c.path);

  return (
    <SiteShell active="news">
      <div className="mx-auto max-w-[1000px] space-y-6 px-6 py-10">
        <h1 className="text-3xl font-extrabold text-navy-800">{t('title')}</h1>
        {rows.length === 0 && <p className="text-ink-500">{t('none')}</p>}
        <div className="grid gap-5 sm:grid-cols-2">
          {rows.map((n) => {
            const c = cover.get(n.id);
            return (
              <a key={n.id} href={`/news/${n.id}`} className="group flex flex-col overflow-hidden rounded-lg border border-ink-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
                {c ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c} alt="" className="h-44 w-full object-cover" />
                ) : (
                  <div className="h-2 w-full bg-gold-300" />
                )}
                <div className="space-y-2 p-5">
                  <div className="flex items-center gap-2">
                    <Badge tone="navy" size="sm">{t(`cat${n.category}`)}</Badge>
                    {n.pinned && <Badge tone="gold" size="sm">{t('pinned')}</Badge>}
                    <span className="text-xs text-ink-400">{fmt(n.publishedAt)}</span>
                  </div>
                  <h2 className="font-bold text-navy-800 group-hover:text-gold-700">{L(n.titleAr, n.titleEn)}</h2>
                  <p className="line-clamp-2 text-sm text-ink-600">{L(n.bodyAr, n.bodyEn)}</p>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </SiteShell>
  );
}
