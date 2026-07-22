'use client';

import { useEffect, useState, useTransition } from 'react';
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
  rejectionReason: string | null;
  publicOk: boolean; // this site's public detail page will actually serve the listing
  // Grab-and-go generated assets (partners get the UNBRANDED poster + the clean map — theirs to
  // reuse). Null when not generated yet (e.g. a listing that has never been published).
  posterUrl?: string | null;
  mapUrl?: string | null;
};

const FAST = ['PUBLISHED', 'SOLD', 'ARCHIVED'];

/** Normalize Arabic-Indic digits (٠-٩ / ۰-۹) to ASCII so Number() parses them. */
const toAsciiDigits = (s: string) =>
  s
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

/** The partner's listings with inline fast edit: price + availability, one tap each.
 *  `publicBase` = this site's public listing path ('/listings' on Al Sawarey, '/market' on the
 *  portal) — powers the «عرض في السوق» button on PUBLISHED rows. */
export function PartnerListings({ rows, locale, publicBase = '/market' }: { rows: PartnerRow[]; locale: 'ar' | 'en'; publicBase?: string }) {
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [prices, setPrices] = useState<Record<string, string>>(Object.fromEntries(rows.map((r) => [r.id, r.price])));
  const [busy, setBusy] = useState('');
  // Inline "sold price" step: the row currently asking + its typed value (no window.prompt).
  const [soldRow, setSoldRow] = useState('');
  const [soldInput, setSoldInput] = useState('');

  // Re-sync from the server after router.refresh(): `prices` was seeded once, so a refreshed row
  // kept showing the OLD value and the next Save (or the SOLD confirmation) wrote it back.
  // Skip the row being acted on right now so we never clobber in-flight typing.
  useEffect(() => {
    setPrices((prev) => {
      const next = { ...prev };
      for (const r of rows) if (r.id !== busy && r.id !== soldRow) next[r.id] = r.price;
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

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
    const raw = toAsciiDigits((prices[id] ?? '').trim());
    const price = raw === '' ? null : Number(raw);
    if (price != null && (Number.isNaN(price) || price < 0)) {
      toast(L('سعر غير صالح', 'Invalid price'), 'error');
      return;
    }
    setBusy(id);
    start(async () => {
      // try/finally: a rejected server action used to skip setBusy(''), leaving the row dimmed
      // and disabled until a full page refresh, with no message.
      try {
        const r = await partnerUpdatePrice(id, price);
        if (r.ok) { toast(L('تم تحديث السعر', 'Price updated')); router.refresh(); }
        else toast(r.error === 'conflict'
          ? L('تغيّر الإعلان — حدّث الصفحة', 'This listing changed — please refresh')
          : L('تعذّر الحفظ', 'Save failed'), 'error');
      } catch {
        toast(L('تعذّر الحفظ', 'Save failed'), 'error');
      } finally {
        setBusy('');
      }
    });
  }

  function setAvail(id: string, status: 'PUBLISHED' | 'SOLD' | 'ARCHIVED', soldPrice: number | null = null) {
    setSoldRow('');
    setBusy(id);
    start(async () => {
      try {
        const r = await partnerSetAvailability(id, status, soldPrice);
        if (r.ok) { toast(L('تم التحديث', 'Updated')); router.refresh(); }
        else toast(
          r.error === 'not_editable' ? L('هذا الإعلان قيد المراجعة', 'This listing is in review')
          : r.error === 'conflict' ? L('تغيّر الإعلان — حدّث الصفحة', 'This listing changed — please refresh')
          : L('تعذّر الحفظ', 'Save failed'), 'error');
      } catch {
        toast(L('تعذّر الحفظ', 'Save failed'), 'error');
      } finally {
        setBusy('');
      }
    });
  }

  /** SOLD asks for the final price inline (numeric keypad, Arabic digits accepted). */
  function confirmSold(id: string) {
    const raw = toAsciiDigits(soldInput.trim());
    const soldPrice = raw === '' ? null : Number(raw);
    if (soldPrice != null && (Number.isNaN(soldPrice) || soldPrice < 0)) {
      toast(L('سعر غير صالح', 'Invalid price'), 'error');
      return;
    }
    setAvail(id, 'SOLD', soldPrice);
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
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-ink-400">👁 {r.views}</span>
                {statusBadge(r.status)}
                {/* The big poster (unbranded — for the partner's own use) + the location map, opened
                    directly in a new tab. Only shown once generated. */}
                {r.posterUrl && (
                  <a
                    href={r.posterUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={L('البوستر بدون علامة — لاستخدامك', 'Unbranded poster — for your own use')}
                    className="inline-flex min-h-10 items-center rounded-md border border-graphite/25 px-3 py-2 text-xs font-semibold hover:bg-graphite/10"
                  >
                    🖼️ {L('البوستر', 'Poster')}
                  </a>
                )}
                {r.mapUrl && (
                  <a
                    href={r.mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={L('خريطة الموقع', 'Location map')}
                    className="inline-flex min-h-10 items-center rounded-md border border-graphite/25 px-3 py-2 text-xs font-semibold hover:bg-graphite/10"
                  >
                    🗺️ {L('الخريطة', 'Map')}
                  </a>
                )}
                {/* Public page exists only once PUBLISHED; the site 308s the raw id to its slug. */}
                {r.status === 'PUBLISHED' && r.publicOk && (
                  <a
                    href={`${publicBase}/${r.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-10 items-center rounded-md border border-gold-400/60 bg-gold/10 px-3 py-2 text-xs font-semibold text-gold-700 hover:bg-gold/20"
                  >
                    🛒 {L('عرض في السوق', 'View in market')}
                  </a>
                )}
                <a href={`/partner/listings/${r.id}/edit`} className="inline-flex min-h-10 items-center rounded-md border border-graphite/25 px-3 py-2 text-xs font-semibold hover:bg-graphite/10">
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
                {/* Two independent switches instead of three competing buttons: one for the sale
                    state, one for public visibility. Each shows its CURRENT state as words, not
                    just a colour — our sellers are low-literacy and often on a relative's phone. */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  {/* BOTH switches read the same way: ON = green = the listing is live and
                      sellable. Previously «الحالة» treated SOLD as ON, so "available" showed grey
                      while "shown" showed green — two identical-looking controls where the same
                      colour meant opposite things. */}
                  <Switch
                    label={L('الحالة', 'Status')}
                    on={r.status !== 'SOLD'}
                    onLabel={L('متاح', 'Available')}
                    offLabel={L('تم البيع', 'Sold')}
                    // Hidden listings aren't public, so the sale state is meaningless until shown.
                    disabled={pending || r.status === 'ARCHIVED'}
                    onChange={(next) => {
                      if (!next) { setSoldRow(r.id); setSoldInput(prices[r.id] ?? ''); }
                      else setAvail(r.id, 'PUBLISHED');
                    }}
                  />
                  <Switch
                    label={L('الظهور', 'Visibility')}
                    on={r.status !== 'ARCHIVED'}
                    onLabel={L('ظاهر', 'Shown')}
                    offLabel={L('مخفي', 'Hidden')}
                    disabled={pending}
                    onChange={(next) => {
                      // Hiding pulls the listing off BOTH public sites instantly — confirm it.
                      if (!next) {
                        if (!window.confirm(L('سيتم إخفاء الإعلان من الموقع. هل أنت متأكد؟', 'This will hide the listing from the website. Are you sure?'))) return;
                        setAvail(r.id, 'ARCHIVED');
                      } else setAvail(r.id, 'PUBLISHED');
                    }}
                  />
                  {r.status === 'ARCHIVED' && (
                    <span className="text-xs text-ink-500">{L('أظهر الإعلان أولاً لتغيير الحالة.', 'Show the listing first to change its status.')}</span>
                  )}
                </div>
              </div>
            ) : r.status === 'REJECTED' ? (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-red-700">{L('مرفوض — عدّل البيانات وأعد الإرسال', 'Rejected — edit the details and resubmit')}</p>
                {r.rejectionReason && (
                  <p className="text-xs text-red-600">{L('سبب الرفض:', 'Rejection reason:')} {r.rejectionReason}</p>
                )}
              </div>
            ) : r.status === 'DRAFT' ? (
              <p className="text-xs text-ink-400">{L('مسودة', 'Draft')}</p>
            ) : (
              <p className="text-xs text-ink-400">{L('قيد مراجعة الإدارة — التعديل السريع غير متاح', 'Under staff review — fast edit unavailable')}</p>
            )}

            {/* Inline sold-price confirm (replaces window.prompt): big numeric input + explicit buttons. */}
            {editable && soldRow === r.id && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gold/40 bg-gold-50 p-3">
                <span className="text-sm font-semibold text-navy-800">{L('سعر البيع النهائي (اختياري):', 'Final sold price (optional):')}</span>
                <input
                  dir="ltr"
                  inputMode="numeric"
                  autoFocus
                  value={soldInput}
                  onChange={(e) => setSoldInput(e.target.value)}
                  placeholder={L('السعر', 'Price')}
                  className="w-36 rounded-md border border-graphite/25 bg-white px-3 py-2 text-sm font-bold text-navy-800"
                />
                <button
                  onClick={() => confirmSold(r.id)}
                  disabled={pending}
                  className="rounded-md bg-navy-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  {L('تأكيد البيع', 'Confirm sold')}
                </button>
                <button
                  onClick={() => setSoldRow('')}
                  disabled={pending}
                  className="rounded-md border border-graphite/25 px-3 py-2 text-sm font-semibold"
                >
                  {L('إلغاء', 'Cancel')}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Labelled on/off switch, identical in meaning wherever it appears:
 *    ON  = green, knob on the RIGHT  = the listing is live / sellable
 *    OFF = grey,  knob on the LEFT   = it is not
 *
 *  The track carries dir="ltr" ON PURPOSE. Platform convention mirrors switches in RTL, which
 *  would put "on" on the left in Arabic and on the right in English — the same control moving
 *  opposite ways per locale. Our sellers are low-tech and the admin is often run in English, so
 *  one physical mental model ("push it right to turn on") beats locale-correctness here.
 *  The state is also spelled out in words beside the track, because colour alone is not a label
 *  for a low-literacy or colour-blind seller. */
function Switch({
  label, on, onLabel, offLabel, onChange, disabled = false,
}: {
  label: string;
  on: boolean;
  onLabel: string;
  offLabel: string;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-xs font-semibold text-ink-500">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={`${label}: ${on ? onLabel : offLabel}`}
        disabled={disabled}
        onClick={() => onChange(!on)}
        className="inline-flex min-h-11 items-center gap-2 rounded-full px-1 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span
          dir="ltr"
          className={`flex h-7 w-12 flex-none items-center rounded-full p-1 transition-colors ${on ? 'justify-end bg-green' : 'justify-start bg-graphite/40'}`}
        >
          <span className="h-5 w-5 rounded-full bg-white shadow" />
        </span>
        <span className={`text-sm font-bold ${on ? '' : 'text-ink-500'}`}>{on ? onLabel : offLabel}</span>
      </button>
    </span>
  );
}
