'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from '@noc/ui';
import { deleteRationingFollow, deleteLandFollow } from './actions';

export function DeleteFollowButton({ id, kind }: { id: string; kind: 'rationing' | 'land' }) {
  const t = useTranslations('account');
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => {
        if (!confirm(t('confirmUnfollow'))) return;
        start(async () => {
          const r = kind === 'rationing' ? await deleteRationingFollow(id) : await deleteLandFollow(id);
          if (!r.ok) toast(t('saveError'), 'error');
        });
      }}
      disabled={pending}
      className="rounded-md border border-red-300 px-3 py-1.5 text-xs text-red-600 disabled:opacity-50"
    >
      {t('unfollow')}
    </button>
  );
}
