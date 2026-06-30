'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toggleWishlist } from '../account/actions';

export function WishlistButton({ listingId, initialSaved, size = 'sm' }: { listingId: string; initialSaved: boolean; size?: 'sm' | 'lg' }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [pending, start] = useTransition();

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    start(async () => {
      const r = await toggleWishlist(listingId);
      if (r.ok) setSaved(r.saved);
      else if (r.needAuth) router.push(`/account/login?next=${encodeURIComponent(window.location.pathname)}`);
    });
  }

  const cls = size === 'lg' ? 'h-11 w-11 text-2xl' : 'h-9 w-9 text-lg';
  return (
    <button
      onClick={toggle}
      disabled={pending}
      aria-label={saved ? 'Remove from wishlist' : 'Add to wishlist'}
      aria-pressed={saved}
      className={`flex ${cls} items-center justify-center rounded-full bg-white/90 shadow-md transition hover:bg-white disabled:opacity-60`}
    >
      <span className={saved ? 'text-danger' : 'text-ink-400'} aria-hidden>{saved ? '♥' : '♡'}</span>
    </button>
  );
}
