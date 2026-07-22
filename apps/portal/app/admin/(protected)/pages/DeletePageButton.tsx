'use client';

import { useTransition } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { deletePage } from './actions';

export function DeletePageButton({ id }: { id: string }) {
  const locale = useLocale() as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!confirm(L('حذف هذه الصفحة؟', 'Delete this page?'))) return;
        start(async () => {
          await deletePage(id);
          router.refresh();
        });
      }}
      className="px-2 py-1 text-red-600 disabled:opacity-50"
    >
      {L('حذف', 'Delete')}
    </button>
  );
}
