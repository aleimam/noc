'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from '@noc/ui';
import { removeWishlistItem } from './actions';

export function WishlistRemove({ itemId, label }: { itemId: string; label: string }) {
  const t = useTranslations('mp');
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await removeWishlistItem(itemId);
          if (r.ok) router.refresh();
          else toast(t('negoError'), 'error');
        })
      }
      className="text-xs font-bold text-danger disabled:opacity-50"
    >
      {label}
    </button>
  );
}
