'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from '@noc/ui';
import { deleteListing } from '../../marketplace/actions';

/** Row delete for the New Obour market list — confirms (naming the listing) before the
 *  shared permanent-delete action runs (photos/posters/location map cleaned up there). */
export function DeleteListingButton({ id, title }: { id: string; title: string }) {
  const t = useTranslations('mp');
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!confirm(`${t('confirmDeleteListing')}\n\n«${title}»`)) return;
        start(async () => {
          const r = await deleteListing(id);
          if (!r.ok) { toast('تعذّر الحذف / Delete failed', 'error'); return; }
          toast('تم الحذف / Deleted');
          router.refresh();
        });
      }}
      className="text-red-600 hover:underline disabled:opacity-50"
    >
      {t('delete')}
    </button>
  );
}
