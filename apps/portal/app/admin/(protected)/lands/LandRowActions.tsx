'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { publishLand, deleteLand } from './actions';

export function LandRowActions({ id, published }: { id: string; published: boolean }) {
  const t = useTranslations('lands');
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <span className="flex items-center justify-end gap-3">
      <a href={`/admin/lands/lands/${id}/edit`} className="text-accent">{t('edit')}</a>
      {!published && (
        <button disabled={pending} onClick={() => start(async () => { await publishLand(id); router.refresh(); })} className="text-green disabled:opacity-50">
          {t('publish')}
        </button>
      )}
      <button
        disabled={pending}
        onClick={() => {
          if (confirm(t('confirmDelete'))) start(async () => { await deleteLand(id); router.refresh(); });
        }}
        className="text-red-600 disabled:opacity-50"
      >
        {t('delete')}
      </button>
    </span>
  );
}
