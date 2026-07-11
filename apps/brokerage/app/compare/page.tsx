import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { StoreShell } from '../_components/StoreShell';
import { landsByIds, type LandCard } from '../../lib/listings';

export const dynamic = 'force-dynamic';
const fmt = (n: number | null) => (n != null ? n.toLocaleString('en') : '—');

export default async function ComparePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const idsRaw = typeof sp.ids === 'string' ? sp.ids : '';
  const ids = idsRaw.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 4);
  const lands = await landsByIds(ids);

  const rows: { label: string; get: (l: LandCard) => string }[] = [
    { label: L('السعر', 'Price'), get: (l) => (l.status === 'SOLD' ? L('تم البيع', 'Sold') : l.price != null ? `${fmt(l.price)} ${L('ج.م', 'EGP')}` : L('عند الطلب', 'On request')) },
    { label: L('المساحة', 'Area'), get: (l) => (l.area != null ? `${fmt(l.area)} ${L('م²', 'm²')}` : '—') },
    { label: L('الجمعية', 'City'), get: (l) => l.cityAr ?? '—' },
    { label: L('الحي', 'District'), get: (l) => l.districtAr ?? '—' },
    { label: L('ناصية', 'Corner'), get: (l) => (l.corner ? '✔' : '—') },
    { label: L('شارع رئيسي', 'Main road'), get: (l) => (l.onMainStreet ? '✔' : '—') },
    { label: L('رقم الإعلان', 'Ad #'), get: (l) => l.adNumber ?? '—' },
  ];

  return (
    <StoreShell>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="mb-5 text-2xl font-black text-navy-800 dark:text-soft">{L('مقارنة الأراضي', 'Compare lands')}</h1>
        {lands.length < 2 ? (
          <p className="rounded-2xl bg-white p-8 text-center text-ink-500 shadow-sm dark:bg-navy-800">
            {L('اختر أرضين على الأقل للمقارنة.', 'Pick at least two lands to compare.')} <Link href="/listings" className="font-bold text-gold-700">{L('تصفّح', 'Browse')}</Link>
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl bg-white shadow-sm dark:bg-navy-800">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-ink-100 dark:border-white/10">
                  <th className="p-3"></th>
                  {lands.map((l) => (
                    <th key={l.id} className="p-3 text-start align-top">
                      <Link href={l.href} className="block font-bold text-navy-800 hover:text-gold-700 dark:text-soft">
                        {l.cover && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={l.cover} alt="" className="mb-2 h-24 w-full rounded-lg object-cover" />
                        )}
                        {l.title}
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} className="border-b border-ink-100 dark:border-white/10">
                    <td className="p-3 font-medium text-ink-500">{r.label}</td>
                    {lands.map((l) => <td key={l.id} className="p-3 text-navy-800 dark:text-soft">{r.get(l)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </StoreShell>
  );
}
