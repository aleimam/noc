'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { setListingArchived, deleteListing } from '../actions';

/** Admin row controls: deactivate (archive) / reactivate a listing, or delete it for good. */
export function ListingAdminActions({ id, archived }: { id: string; archived: boolean }) {
  const t = useTranslations('mp');
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="flex items-center justify-end gap-3">
      <button
        disabled={pending}
        onClick={() => start(async () => { await setListingArchived(id, !archived); router.refresh(); })}
        className="text-accent disabled:opacity-50"
      >
        {archived ? t('activate') : t('deactivate')}
      </button>
      <button
        disabled={pending}
        onClick={() => {
          if (!confirm(t('confirmDeleteListing'))) return;
          start(async () => { await deleteListing(id); router.refresh(); });
        }}
        className="text-red-600 disabled:opacity-50"
      >
        {t('delete')}
      </button>
    </div>
  );
}
