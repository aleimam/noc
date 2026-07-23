'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';

/** Filter + sort toolbar for the sale-offers list. Drives the server query via URL params. */
export function OffersToolbar({ total }: { total: number }) {
  const locale = useLocale() as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const set = (key: string, val: string) => {
    const p = new URLSearchParams(sp.toString());
    if (val) p.set(key, val);
    else p.delete(key);
    if (key !== 'page') p.delete('page');
    const s = p.toString();
    router.push(s ? `${pathname}?${s}` : pathname);
  };

  const inp = 'rounded-md border border-graphite/20 bg-transparent px-2 py-1.5 text-sm';
  const STATUSES: Array<[string, string, string]> = [
    ['', 'كل الحالات', 'All statuses'],
    ['NEW', 'جديد', 'New'],
    ['REVIEWING', 'قيد المراجعة', 'Reviewing'],
    ['ACCEPTED', 'مقبول', 'Accepted'],
    ['REJECTED', 'مرفوض', 'Rejected'],
  ];
  const SORTS: Array<[string, string, string]> = [
    ['newest', 'الأحدث', 'Newest'],
    ['oldest', 'الأقدم', 'Oldest'],
    ['price_desc', 'السعر (الأعلى)', 'Price (high)'],
    ['price_asc', 'السعر (الأقل)', 'Price (low)'],
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const v = (e.currentTarget.elements.namedItem('q') as HTMLInputElement)?.value ?? '';
          set('q', v.trim());
        }}
        className="flex items-center gap-1"
      >
        <input name="q" defaultValue={sp.get('q') ?? ''} placeholder={L('بحث بالمالك أو الهاتف', 'Search owner or phone')} className={`${inp} w-48`} />
        <button type="submit" className="rounded-md bg-primary px-3 py-1.5 text-sm text-soft">{L('بحث', 'Search')}</button>
      </form>
      <select value={sp.get('status') ?? ''} onChange={(e) => set('status', e.target.value)} className={inp}>
        {STATUSES.map(([v, ar, en]) => (<option key={v} value={v}>{L(ar, en)}</option>))}
      </select>
      <select value={sp.get('sort') ?? 'newest'} onChange={(e) => set('sort', e.target.value)} className={inp}>
        {SORTS.map(([v, ar, en]) => (<option key={v} value={v}>{L(ar, en)}</option>))}
      </select>
      {(sp.get('q') || sp.get('status')) && (
        <button type="button" onClick={() => router.push(pathname)} className="text-sm text-accent underline">{L('مسح الفلاتر', 'Clear filters')}</button>
      )}
      <span className="ms-auto text-sm opacity-60">{L('النتائج', 'Results')}: <b className="font-num">{total}</b></span>
    </div>
  );
}
