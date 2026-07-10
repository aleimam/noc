'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@noc/ui';
import { partnerUpdatePrice, partnerSetAvailability } from './actions';

export type PartnerRow = {
  id: string;
  title: string;
  adNumber: string | null;
  status: string;
  price: string; // decimal as string
  views: number;
};

const FAST = ['PUBLISHED', 'SOLD', 'ARCHIVED'];

/** The partner's listings with inline fast edit: price + availability, one tap each. */
export function PartnerListings({ rows, locale }: { rows: PartnerRow[]; locale: 'ar' | 'en' }) {
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [prices, setPrices] = useState<Record<string, string>>(Object.fromEntries(rows.map((r) => [r.id, r.price])));
  const [busy, setBusy] = useState('');

  const statusBadge = (s: string) => {
    const map: Record<string, { ar: string; en: string; cls: string }> = {
      PUBLISHED: { ar: 'متاح', en: 'Available', cls: 'bg-green/15 text-green' },
      SOLD: { ar: 'تم البيع', en: 'Sold', cls: 'bg-gold/25 text-navy-800' },
      ARCHIVED: { ar: 'مخفي', en: 'Hidden', cls: 'bg-graphite/15 opacity-80' },
      PENDING: { ar: 'قيد المراجعة', en: 'In review', cls: 'bg-amber-100 text-amber-800' },
      DRAFT: { ar: 'مسودة', en: 'Draft', cls: 'bg-graphite/10 opacity-70' },
      REJECTED: { ar: 'مرفوض', en: 'Rejected', cls: 'bg-red-100 text-red-700' },
    };
    const m = map[s] ?? { ar: s, en: s, cls: 'bg-graphite/10' };
    return <span className={`rounded-full px-3 py-1 text-xs font-bold ${m.cls}`}>{L(m.ar, m.en)}</span>;
  };

  function savePrice(id: string) {
    const raw = (prices[id] ?? '').trim();
    const price = raw === '' ? null : Number(raw);
    if (price != null && (Number.isNaN(price) || price < 0)) {
      toast(L('سعر غير صالح', 'Invalid price'), 'error');
      return;
    }
    setBusy(id);
    start(async () => {
      const r = await partnerUpdatePrice(id, price);
      setBusy('');
      if (r.ok) { toast(L('تم تحديث السعر', 'Price updated')); router.refresh(); }
      else toast(L('تعذّر الحفظ', 'Save failed'), 'error');
    });
  }

  function setAvail(id: string, status: 'PUBLISHED' | 'SOLD' | 'ARCHIVED') {
    let soldPrice: number | null | undefined;
    if (status === 'SOLD') {
      const raw = window.prompt(L('سعر البيع النهائي (اختياري):', 'Final sold price (optional):'), prices[id] ?? '');
      if (raw === null) return; // cancelled
      soldPrice = raw.trim() === '' ? null : Number(raw);
      if (soldPrice != null && (Number.isNaN(soldPrice) || soldPrice < 0)) {
        toast(L('سعر غير صالح', 'Invalid price'), 'error');
        return;
      }
    }
    setBusy(id);
    start(async () => {
      const r = await partnerSetAvailability(id, status, soldPrice ?? null);
      setBusy('');
      if (r.ok) { toast(L('تم التحديث', 'Updated')); router.refresh(); }
      else toast(r.error === 'not_editable' ? L('هذا الإعلان قيد المراجعة', 'This listing is in review') : L('تعذّر الحفظ', 'Save failed'), 'error');
    });
  }

  if (rows.length === 0) {
    return <p className="rounded-lg border border-ink-200 bg-white p-6 text-center text-ink-500">{L('لا توجد إعلانات بعد', 'No listings yet')}</p>;
  }

  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const editable = FAST.includes(r.status);
        return (
          <div key={r.id} className={`space-y-3 rounded-lg border border-ink-200 bg-white p-4 shadow-sm ${busy === r.id ? 'opacity-60' : ''}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-navy-800">{r.title}</span>
                {r.adNumber && <span className="font-num text-xs text-ink-400" dir="ltr">#{r.adNumber}</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-400">👁 {r.views}</span>
                {statusBadge(r.status)}
                <a href={`/partner/listings/${r.id}/edit`} className="rounded-md border border-graphite/25 px-3 py-1 text-xs font-semibold hover:bg-graphite/10">
                  ✎ {L('تعديل', 'Edit')}
                </a>
              </div>
            </div>

            {editable ? (
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <input
                    dir="ltr"
                    inputMode="numeric"
                    value={prices[r.id] ?? ''}
                    onChange={(e) => setPrices((p) => ({ ...p, [r.id]: e.target.value }))}
                    placeholder={L('السعر', 'Price')}
                    className="w-36 rounded-md border border-graphite/25 bg-transparent px-3 py-2 text-sm font-bold"
                  />
                  <span className="text-xs text-ink-500">{L('ج.م', 'EGP')}</span>
                  <button
                    onClick={() => savePrice(r.id)}
                    disabled={pending}
                    className="rounded-md bg-primary px-3 py-2 text-sm font-bold text-soft disabled:opacity-50"
                  >
                    {L('حفظ السعر', 'Save price')}
                  </button>
                </div>
                <div className="flex gap-2">
                  {(['PUBLISHED', 'SOLD', 'ARCHIVED'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setAvail(r.id, s)}
                      disabled={pending || r.status === s}
                      className={`rounded-lg px-4 py-2 text-sm font-bold ${r.status === s ? 'bg-navy-800 text-white' : 'border border-graphite/25 hover:bg-graphite/10'} disabled:cursor-default`}
                    >
                      {s === 'PUBLISHED' ? L('متاح', 'Available') : s === 'SOLD' ? L('تم البيع', 'Sold') : L('إخفاء', 'Hide')}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-ink-400">{L('قيد مراجعة الإدارة — التعديل السريع غير متاح', 'Under staff review — fast edit unavailable')}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
