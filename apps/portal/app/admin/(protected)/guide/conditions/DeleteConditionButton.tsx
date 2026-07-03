'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteBuildingCondition } from './actions';

export function DeleteConditionButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!confirm('حذف هذه الصفحة؟')) return;
        start(async () => { await deleteBuildingCondition(id); router.refresh(); });
      }}
      className="text-red-600 disabled:opacity-50"
    >
      حذف
    </button>
  );
}
