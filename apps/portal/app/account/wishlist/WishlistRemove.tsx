'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { removeWishlistItem } from './actions';

export function WishlistRemove({ itemId, label }: { itemId: string; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => { const r = await removeWishlistItem(itemId); if (r.ok) router.refresh(); })}
      className="text-xs font-bold text-red-600 disabled:opacity-50"
    >
      {label}
    </button>
  );
}
