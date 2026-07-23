'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';

/** Filter + sort toolbar for the listings table. Drives the server query via URL search params
 *  (?q=&status=&type=&sort=&page=), so it's shareable/bookmarkable and works with the back button.
 *  Any change resets to page 1. */
export function ListingsToolbar({ types, total }: { types: { id: string; label: string }[]; total: number }) {
  const locale = useLocale() as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const set = (key: string, val: string) => {
    const p = new URLSearchParams(sp.toString());
    if (val) p.set(key, val);
    else p.delete(key);
    if (key !== 'page') p.delete('page'); // filter/sort change → back to the first page
    const s = p.toString();
    router.push(s ? `${pathname}?${s}` : pathname);
  };

  const inp = 'rounded-md border border-graphite/20 bg-transparent px-2 py-1.5 text-sm';
  const STATUSES: Array<[string, string, string]> = [
    ['', 'كل الحالات', 'All statuses'],
    ['PUBLISHED', 'منشور', 'Published'],
    ['ARCHIVED', 'معطّل', 'Deactivated'],
    ['REJECTED', 'مرفوض', 'Rejected'],
    ['SOLD', 'تم البيع', 'Sold'],
    ['DRAFT', 'مسودة', 'Draft'],
  ];
  const SORTS: Array<[string, string, string]> = [
    ['recent', 'الأحدث', 'Newest'],
    ['oldest', 'الأقدم', 'Oldest'],
    ['price_desc', 'السعر (الأعلى)', 'Price (high)'],
    ['price_asc', 'السعر (الأقل)', 'Price (low)'],
    ['area_desc', 'المساحة (الأكبر)', 'Area (large)'],
    ['area_asc', 'المساحة (الأصغر)', 'Area (small)'],
    ['title', 'العنوان (أ–ي)', 'Title (A–Z)'],
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
        <input name="q" defaultValue={sp.get('q') ?? ''} placeholder={L('بحث بالعنوان أو المالك', 'Search title or owner')} className={`${inp} w-48`} />
        <button type="submit" className="rounded-md bg-primary px-3 py-1.5 text-sm text-soft">{L('بحث', 'Search')}</button>
      </form>

      <select value={sp.get('status') ?? ''} onChange={(e) => set('status', e.target.value)} className={inp}>
        {STATUSES.map(([v, ar, en]) => (<option key={v} value={v}>{L(ar, en)}</option>))}
      </select>

      <select value={sp.get('type') ?? ''} onChange={(e) => set('type', e.target.value)} className={inp}>
        <option value="">{L('كل الأنواع', 'All types')}</option>
        {types.map((tp) => (<option key={tp.id} value={tp.id}>{tp.label}</option>))}
      </select>

      <select value={sp.get('sort') ?? 'recent'} onChange={(e) => set('sort', e.target.value)} className={inp}>
        {SORTS.map(([v, ar, en]) => (<option key={v} value={v}>{L(ar, en)}</option>))}
      </select>

      {(sp.get('q') || sp.get('status') || sp.get('type')) && (
        <button type="button" onClick={() => router.push(pathname)} className="text-sm text-accent underline">{L('مسح الفلاتر', 'Clear filters')}</button>
      )}

      <span className="ms-auto text-sm opacity-60">{L('النتائج', 'Results')}: <b className="font-num">{total}</b></span>
    </div>
  );
}
