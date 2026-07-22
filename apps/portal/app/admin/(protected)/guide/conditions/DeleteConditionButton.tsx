'use client';

import { useTransition } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { deleteBuildingCondition } from './actions';

export function DeleteConditionButton({ id }: { id: string }) {
  const locale = useLocale() as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!confirm(L('حذف هذه الصفحة؟', 'Delete this page?'))) return;
        start(async () => { await deleteBuildingCondition(id); router.refresh(); });
      }}
      className="text-red-600 disabled:opacity-50"
    >
      {L('حذف', 'Delete')}
    </button>
  );
}
