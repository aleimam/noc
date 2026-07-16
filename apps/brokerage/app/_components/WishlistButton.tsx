'use client';

import { useState, useTransition } from 'react';
import { toast, track, nocEvent } from '@noc/ui';
import { toggleWishlist } from '../account/actions';

export function WishlistButton({ listingId, initialSaved, size = 'sm', locale = 'ar' }: { listingId: string; initialSaved: boolean; size?: 'sm' | 'lg'; locale?: 'ar' | 'en' }) {
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const [saved, setSaved] = useState(initialSaved);
  const [pending, start] = useTransition();

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    start(async () => {
      const r = await toggleWishlist(listingId);
      if (r.ok) {
        setSaved(r.saved);
        if (r.saved) { track('wishlist_add', { listingId }); nocEvent('wishlist', listingId); }
      } else {
        toast(L('تعذّر الحفظ، حاول مرة أخرى', 'Could not save, try again'), 'error');
      }
    });
  }

  // ≥40px both sizes (golden rule: big tap targets — low-tech users on phones).
  const cls = size === 'lg' ? 'h-11 w-11 text-2xl' : 'h-10 w-10 text-xl';
  return (
    <button
      onClick={toggle}
      disabled={pending}
      aria-label={saved ? L('إزالة من المفضلة', 'Remove from wishlist') : L('إضافة إلى المفضلة', 'Add to wishlist')}
      aria-pressed={saved}
      className={`flex ${cls} items-center justify-center rounded-full bg-white/90 shadow-md transition hover:bg-white disabled:opacity-60`}
    >
      <span className={saved ? 'text-danger' : 'text-ink-400'} aria-hidden>{saved ? '♥' : '♡'}</span>
    </button>
  );
}
