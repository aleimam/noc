'use client';

import { useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { toast } from '@noc/ui';
import { setListingArchived, deleteListing, toggleFeatured } from '../actions';

export type RecentRow = {
  id: string;
  adNumber: string | null;
  title: string;
  typeLabel: string;
  area: number | null;
  price: number | null;
  ownerName: string;
  status: string;
  featured: boolean;
  showOnBrokerage: boolean;
  brokerageHref: string | null; // absolute alsawarey.com URL when the row is actually viewable there
  posterUrl: string | null;
  mapUrl: string | null;
};

const STATUS_BADGE: Record<string, string> = {
  REJECTED: 'bg-red-100 text-red-700',
  SOLD: 'bg-navy/10 text-primary',
  DRAFT: 'bg-graphite/10 text-graphite',
};

/** The PUBLISHED/REJECTED listings table. A CLIENT component so every control updates the row
 *  in place (optimistic) instead of needing a manual page reload — server-action + router.refresh
 *  alone was leaving the page stale for the owner. */
export function RecentListingsTable({ rows: initialRows }: { rows: RecentRow[] }) {
  const locale = useLocale() as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const t = useTranslations('mp');
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [rows, setRows] = useState(initialRows);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [, start] = useTransition();
  const fmt = (n: number) => n.toLocaleString('en');

  // Clickable-header sorting: cycle a column asc → desc → default(recent). Drives ?sort= in the URL
  // so the server re-queries and this table remounts (via the parent's `key`) with sorted rows.
  const currentSort = sp.get('sort') || 'recent';
  const clickSort = (field: string) => {
    const asc = `${field}_asc`;
    const desc = `${field}_desc`;
    const next = currentSort === asc ? desc : currentSort === desc ? 'recent' : asc;
    const p = new URLSearchParams(sp.toString());
    if (next === 'recent') p.delete('sort');
    else p.set('sort', next);
    p.delete('page');
    const s = p.toString();
    router.push(s ? `${pathname}?${s}` : pathname);
  };

  const setRowBusy = (id: string, on: boolean) =>
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  // On/off switch: ON = منشور (live), OFF = معطّل (archived). Optimistic flip; reverts on failure.
  function toggleStatus(row: RecentRow) {
    if (row.status !== 'PUBLISHED' && row.status !== 'ARCHIVED') return;
    const wasPublished = row.status === 'PUBLISHED';
    const nextStatus = wasPublished ? 'ARCHIVED' : 'PUBLISHED';
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, status: nextStatus } : r)));
    setRowBusy(row.id, true);
    start(async () => {
      const r = await setListingArchived(row.id, wasPublished); // archived = wasPublished
      setRowBusy(row.id, false);
      if (!r.ok) {
        setRows((rs) => rs.map((x) => (x.id === row.id ? { ...x, status: row.status } : x))); // revert
        toast(
          r.error === 'missing_required'
            ? L('لا يمكن التفعيل — بيانات مطلوبة ناقصة', 'Can’t activate — required details are missing')
            : r.error === 'bad_status'
              ? L('تغيّرت حالة الإعلان — حدّث الصفحة', 'Listing status changed — refresh the page')
              : L('تعذّر الحفظ', 'Save failed'),
          'error',
        );
        return;
      }
      router.refresh();
    });
  }

  function toggleFeat(row: RecentRow) {
    const next = !row.featured;
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, featured: next } : r)));
    setRowBusy(row.id, true);
    start(async () => {
      const r = await toggleFeatured(row.id, next);
      setRowBusy(row.id, false);
      if (!r.ok) {
        setRows((rs) => rs.map((x) => (x.id === row.id ? { ...x, featured: !next } : x)));
        toast(L('تعذّر الحفظ', 'Save failed'), 'error');
      }
    });
  }

  function remove(row: RecentRow) {
    if (!confirm(t('confirmDeleteListing'))) return;
    setRows((rs) => rs.filter((r) => r.id !== row.id)); // optimistic hide
    start(async () => {
      const r = await deleteListing(row.id);
      if (!r.ok) {
        setRows((rs) => (rs.some((x) => x.id === row.id) ? rs : [...initialRows.filter((x) => x.id === row.id), ...rs]));
        toast(L('تعذّر الحذف', 'Delete failed'), 'error');
        return;
      }
      router.refresh();
    });
  }

  const th = 'p-2 text-start font-semibold';
  const arrowFor = (field: string) => (currentSort === `${field}_asc` ? '▲' : currentSort === `${field}_desc` ? '▼' : '');
  const sortTh = (field: string, label: string) => (
    <th className={th}>
      <button type="button" onClick={() => clickSort(field)} className="inline-flex items-center gap-0.5 font-semibold hover:text-accent" title={L('اضغط للترتيب', 'Click to sort')}>
        <span>{label}</span>
        <span className="w-2 text-[9px] opacity-70">{arrowFor(field)}</span>
      </button>
    </th>
  );
  return (
    <div className="overflow-x-auto rounded-lg border border-graphite/15">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-graphite/15 bg-graphite/5 text-xs opacity-70">
            {sortTh('adnum', L('رقم الإعلان', 'Ad no.'))}
            {sortTh('title', L('العنوان', 'Title'))}
            {sortTh('type', L('النوع', 'Type'))}
            {/* Area lives in the EAV `area` value, which Prisma can't orderBy — so it's filterable
                (toolbar range) + displayed, but not a click-to-sort column. */}
            <th className={th}>{L('المساحة', 'Area')}</th>
            {sortTh('price', L('السعر', 'Price'))}
            {sortTh('owner', L('المالك', 'Owner'))}
            {/* «الصواري» column — the Al Sawarey brand mark stands in for the header word. */}
            <th className={th}>
              <img src="/alsawarey-mark.png" alt={L('الصواري', 'Al Sawarey')} title={L('معروض على الصواري', 'On the Al Sawarey storefront')} className="inline-block h-5 w-5 object-contain align-middle" />
            </th>
            {sortTh('status', L('الحالة', 'Status'))}
            <th className={th}>{L('مميز', 'Featured')}</th>
            <th className={th}>{L('بوستر', 'Poster')}</th>
            <th className={th}>{L('خريطة', 'Map')}</th>
            <th className={`${th} text-end`}>{L('إجراءات', 'Actions')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isBusy = busy.has(r.id);
            const toggleable = r.status === 'PUBLISHED' || r.status === 'ARCHIVED';
            const on = r.status === 'PUBLISHED';
            return (
              <tr key={r.id} className="border-t border-graphite/10 first:border-t-0 align-top">
                <td className="whitespace-nowrap p-2">
                  {/* Ad number is the New Obour view link (new tab) — but only PUBLISHED rows have a
                      public page; others (drafts have no ad number anyway) show it as plain text. */}
                  {r.adNumber ? (
                    r.status === 'PUBLISHED' ? (
                      <a href={`/market/${r.id}`} target="_blank" rel="noopener noreferrer" className="font-num font-semibold text-accent hover:underline" dir="ltr" title={L('فتح الإعلان في السوق (العبور)', 'Open on New Obour')}>{r.adNumber}</a>
                    ) : (
                      <span className="font-num opacity-70" dir="ltr">{r.adNumber}</span>
                    )
                  ) : (
                    <span className="opacity-30">—</span>
                  )}
                </td>
                <td className="p-2">
                  <div className="max-w-[18rem] whitespace-normal break-words font-medium" title={r.title}>{r.title}</div>
                </td>
                <td className="p-2 text-xs opacity-70">{r.typeLabel}</td>
                <td className="whitespace-nowrap p-2 text-xs opacity-70">{r.area != null ? `${fmt(r.area)} ${L('م²', 'm²')}` : '—'}</td>
                <td className="whitespace-nowrap p-2 text-xs opacity-70">
                  {r.price != null ? <span dir="ltr" className="font-num">{fmt(r.price)}</span> : <span className="opacity-60">{L('عند الطلب', 'On req.')}</span>}
                </td>
                <td className="p-2 text-xs opacity-70">{r.ownerName}</td>
                <td className="p-2 text-center">
                  {r.showOnBrokerage ? (
                    r.brokerageHref ? (
                      <a href={r.brokerageHref} target="_blank" rel="noopener noreferrer" className="text-green hover:underline" title={L('عرض على الصواري', 'View on Al Sawarey')}>✓</a>
                    ) : (
                      <span className="text-green" title={L('مُفعّل للصواري (غير قابل للعرض الآن)', 'Marked for Al Sawarey (not viewable now)')}>✓</span>
                    )
                  ) : (
                    <span className="opacity-30">—</span>
                  )}
                </td>
                <td className="p-2">
                  {toggleable ? (
                    <button
                      type="button"
                      dir="ltr"
                      disabled={isBusy}
                      onClick={() => toggleStatus(r)}
                      aria-pressed={on}
                      title={on ? L('منشور — اضغط للتعطيل', 'Published — click to deactivate') : L('معطّل — اضغط للنشر', 'Deactivated — click to publish')}
                      className="inline-flex items-center gap-1.5 disabled:opacity-40"
                    >
                      <span className={`relative inline-block h-5 w-9 shrink-0 rounded-full transition-colors ${on ? 'bg-green' : 'bg-graphite/30'}`}>
                        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${on ? 'left-4' : 'left-0.5'}`} />
                      </span>
                      <span className="text-xs font-semibold">{on ? L('منشور', 'Live') : L('معطّل', 'Off')}</span>
                    </button>
                  ) : (
                    <span className={`inline-block rounded px-2 py-0.5 text-xs ${STATUS_BADGE[r.status] ?? 'bg-graphite/10 text-graphite'}`}>{t(`status${r.status}`)}</span>
                  )}
                </td>
                <td className="p-2">
                  {/* Featured is a storefront flag — only meaningful for a PUBLISHED listing shown
                      on Al Sawarey (same gate as before). */}
                  {r.showOnBrokerage && r.status === 'PUBLISHED' ? (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => toggleFeat(r)}
                      aria-pressed={r.featured}
                      title={r.featured ? L('مميز — اضغط لإلغاء التمييز', 'Featured — click to unfeature') : L('تمييز', 'Feature')}
                      className={`rounded px-2 py-0.5 text-base leading-none ${r.featured ? 'bg-gold-600 text-white' : 'border border-graphite/20 opacity-60'} disabled:opacity-40`}
                    >
                      ★
                    </button>
                  ) : (
                    <span className="opacity-30">—</span>
                  )}
                </td>
                <td className="p-2 text-center">
                  {r.posterUrl ? (
                    <a href={r.posterUrl} target="_blank" rel="noopener noreferrer" className="text-lg leading-none" title={L('البوستر الكبير', 'Big poster')} aria-label={L('البوستر الكبير', 'Big poster')}>🖼️</a>
                  ) : (
                    <span className="opacity-30">—</span>
                  )}
                </td>
                <td className="p-2 text-center">
                  {r.mapUrl ? (
                    <a href={r.mapUrl} target="_blank" rel="noopener noreferrer" className="text-lg leading-none" title={L('خريطة الموقع', 'Location map')} aria-label={L('خريطة الموقع', 'Location map')}>🗺️</a>
                  ) : (
                    <span className="opacity-30">—</span>
                  )}
                </td>
                <td className="p-2">
                  <div className="flex items-center justify-end gap-3">
                    <a href={`/admin/marketplace/listings/${r.id}/edit`} className="text-lg leading-none" title={t('edit')} aria-label={t('edit')}>✏️</a>
                    <button type="button" disabled={isBusy} onClick={() => remove(r)} className="text-lg leading-none disabled:opacity-40" title={t('delete')} aria-label={t('delete')}>🗑️</button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
