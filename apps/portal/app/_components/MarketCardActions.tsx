'use client';

import { useEffect, useState, useTransition } from 'react';
import { useLocale } from 'next-intl';
import { nocEvent, toast } from '@noc/ui';
import { getCompare, toggleCompare, COMPARE_EVENT } from './compare';
import { toggleWishlist } from '../account/wishlist/actions';

// Overlay on a listing card's media: a wishlist heart + a compare toggle. Kept tiny + tappable.
export function MarketCardActions({ listingId, initialSaved, compareLabel }: { listingId: string; initialSaved: boolean; compareLabel: string }) {
  const locale = useLocale();
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const [saved, setSaved] = useState(initialSaved);
  const [pending, start] = useTransition();
  const [cmp, setCmp] = useState(false);

  useEffect(() => {
    const sync = () => setCmp(getCompare().includes(listingId));
    sync();
    window.addEventListener(COMPARE_EVENT, sync);
    return () => window.removeEventListener(COMPARE_EVENT, sync);
  }, [listingId]);

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        aria-pressed={saved}
        aria-label={L('المفضلة', 'Wishlist')}
        disabled={pending}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          start(async () => {
            const r = await toggleWishlist(listingId);
            if (r.ok) { setSaved(r.saved); if (r.saved) nocEvent('wishlist', listingId); }
            else toast(L('تعذّر الحفظ — حاول مرة أخرى', 'Could not save — try again'), 'error');
          });
        }}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-lg shadow-md transition hover:bg-white disabled:opacity-60"
      >
        <span className={saved ? 'text-danger' : 'text-ink-400'} aria-hidden>{saved ? '♥' : '♡'}</span>
      </button>
      <button
        type="button"
        aria-pressed={cmp}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const r = toggleCompare(listingId);
          if (r === 'max') toast(L('الحد الأقصى ٤ للمقارنة', 'Compare is limited to 4'), 'error');
          else setCmp(r);
        }}
        className={`rounded-md px-2 py-1 text-[11px] font-bold shadow ${cmp ? 'bg-navy-700 text-white' : 'bg-white/90 text-navy-700'}`}
      >
        ⇄ {compareLabel}
      </button>
    </div>
  );
}
