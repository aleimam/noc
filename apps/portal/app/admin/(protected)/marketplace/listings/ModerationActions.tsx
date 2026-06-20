'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { approveListing, rejectListing } from '../actions';

export function ModerationActions({ id }: { id: string }) {
  const t = useTranslations('mp');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  return rejecting ? (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('rejectionReason')} className="rounded border border-graphite/20 bg-transparent px-2 py-1 text-sm" />
      <button disabled={pending} onClick={() => start(async () => { await rejectListing(id, reason); router.refresh(); })} className="rounded bg-red-600 px-2 py-1 text-sm text-white">{t('reject')}</button>
      <button onClick={() => setRejecting(false)} className="text-sm opacity-60">{t('cancel')}</button>
    </div>
  ) : (
    <div className="flex justify-end gap-2">
      <button disabled={pending} onClick={() => start(async () => { await approveListing(id); router.refresh(); })} className="rounded bg-primary px-3 py-1 text-sm text-soft">{t('approve')}</button>
      <button onClick={() => setRejecting(true)} className="rounded border border-red-600 px-3 py-1 text-sm text-red-600">{t('reject')}</button>
    </div>
  );
}
