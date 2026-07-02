'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { setMyListingStatus } from './actions';

export function MyListingActions({ id, status }: { id: string; status: string }) {
  const t = useTranslations('mp');
  const router = useRouter();
  const [pending, start] = useTransition();
  const act = (s: 'SOLD' | 'ARCHIVED' | 'DRAFT' | 'PENDING') =>
    start(async () => {
      await setMyListingStatus(id, s);
      router.refresh();
    });

  return (
    <div className="flex flex-col items-end gap-1 text-sm">
      <a href={`/account/listings/${id}/edit`} className="text-accent">{t('edit')}</a>
      {status !== 'SOLD' && (
        <button disabled={pending} onClick={() => act('SOLD')} className="text-green">{t('markSold')}</button>
      )}
      {status !== 'ARCHIVED' && (
        <button disabled={pending} onClick={() => act('ARCHIVED')} className="opacity-60 hover:opacity-100">{t('archive')}</button>
      )}
    </div>
  );
}
