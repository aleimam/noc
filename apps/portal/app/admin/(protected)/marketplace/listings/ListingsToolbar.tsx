'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';

/** Filter toolbar for the listings table. Drives the server query via URL search params
 *  (?q=&status=&type=&amin=&amax=&page=), so it's shareable/bookmarkable and works with the back
 *  button. Any change resets to page 1. Sorting lives on the table's clickable column headers (?sort=). */
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
    if (key !== 'page') p.delete('page'); // filter change → back to the first page
    const s = p.toString();
    router.push(s ? `${pathname}?${s}` : pathname);
  };
  // Set several params at once (used by the area-range form so min+max apply together).
  const setMany = (entries: Record<string, string>) => {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(entries)) { if (v) p.set(k, v); else p.delete(k); }
    p.delete('page');
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

      {/* Actual-area range (م²). Applies min+max together on submit/Enter. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = e.currentTarget;
          setMany({
            amin: (f.elements.namedItem('amin') as HTMLInputElement).value.trim(),
            amax: (f.elements.namedItem('amax') as HTMLInputElement).value.trim(),
          });
        }}
        className="flex items-center gap-1"
      >
        <span className="text-xs opacity-60">{L('المساحة', 'Area')}</span>
        <input name="amin" type="number" min="0" inputMode="numeric" defaultValue={sp.get('amin') ?? ''} placeholder={L('من', 'min')} className={`${inp} w-20`} dir="ltr" />
        <input name="amax" type="number" min="0" inputMode="numeric" defaultValue={sp.get('amax') ?? ''} placeholder={L('إلى', 'max')} className={`${inp} w-20`} dir="ltr" />
        <button type="submit" className="rounded-md bg-primary px-2 py-1.5 text-xs text-soft">{L('تصفية', 'Apply')}</button>
      </form>

      {(sp.get('q') || sp.get('status') || sp.get('type') || sp.get('amin') || sp.get('amax') || sp.get('sort')) && (
        <button type="button" onClick={() => router.push(pathname)} className="text-sm text-accent underline">{L('مسح الفلاتر', 'Clear filters')}</button>
      )}

      <span className="ms-auto text-sm opacity-60">{L('النتائج', 'Results')}: <b className="font-num">{total}</b></span>
    </div>
  );
}
