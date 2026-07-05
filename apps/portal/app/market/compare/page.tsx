import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { prisma } from '@noc/db';
import { currency } from '@noc/i18n';
import { SiteShell } from '../../_components/SiteShell';

export const dynamic = 'force-dynamic';

export default async function ComparePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const ids = String(sp.ids ?? '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 4);
  const locale = (await getLocale()) as 'ar' | 'en';
  const t = await getTranslations('mp');
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  const listings = ids.length
    ? await prisma.listing.findMany({ where: { id: { in: ids }, status: 'PUBLISHED' }, include: { typeOption: true, neighborhood: { include: { district: true } } } })
    : [];
  const byId = new Map(listings.map((l) => [l.id, l]));
  const ordered = ids.map((i) => byId.get(i)).filter((l): l is NonNullable<typeof l> => !!l);
  const covers = new Map<string, string>();
  if (ordered.length) {
    const rows = await prisma.attachment.findMany({ where: { ownerType: 'Listing', ownerId: { in: ordered.map((l) => l.id) }, attributeId: null }, orderBy: { createdAt: 'asc' }, select: { ownerId: true, path: true } });
    for (const r of rows) if (r.ownerId && !covers.has(r.ownerId)) covers.set(r.ownerId, r.path);
  }

  const fields: { label: string; get: (l: (typeof ordered)[number]) => string }[] = [
    { label: L('السعر', 'Price'), get: (l) => (l.price != null ? `${Number(l.price).toLocaleString('en')} ${currency(locale)}` : '—') },
    { label: L('المساحة الفعلية', 'Actual area'), get: (l) => (l.area != null ? `${Number(l.area)} ${L('م²', 'm²')}` : '—') },
    { label: L('النوع', 'Type'), get: (l) => L(l.typeOption?.nameAr ?? '', l.typeOption?.nameEn ?? '') || '—' },
    { label: L('المنطقة', 'Location'), get: (l) => (l.neighborhood ? `${L(l.neighborhood.district.nameAr, l.neighborhood.district.nameEn)} · ${L(l.neighborhood.nameAr, l.neighborhood.nameEn)}` : '—') },
  ];

  return (
    <SiteShell active="market">
      <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-black text-navy-800 dark:text-soft">{t('compareTitle')}</h1>
          <Link href="/market" className="text-sm text-accent">← {t('title')}</Link>
        </div>

        {ordered.length < 2 ? (
          <p className="rounded-2xl border border-ink-200 bg-white p-6 text-center text-ink-600">{t('compareEmpty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="p-2" />
                  {ordered.map((l) => (
                    <th key={l.id} className="p-2 align-top">
                      <Link href={`/market/${l.id}`} className="block">
                        <div className="aspect-[16/10] overflow-hidden rounded-lg bg-navy-100">
                          {covers.get(l.id) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={covers.get(l.id)!} alt="" className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                        <div className="mt-1 font-bold text-navy-800 hover:underline dark:text-soft">{l.title}</div>
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fields.map((f) => (
                  <tr key={f.label} className="border-t border-ink-200">
                    <td className="whitespace-nowrap p-2 font-semibold text-ink-600">{f.label}</td>
                    {ordered.map((l) => <td key={l.id} className="p-2 text-navy-800 dark:text-soft">{f.get(l)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </SiteShell>
  );
}
