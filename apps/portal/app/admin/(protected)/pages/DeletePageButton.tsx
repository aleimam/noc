'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deletePage } from './actions';

export function DeletePageButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!confirm('حذف هذه الصفحة؟')) return;
        start(async () => {
          await deletePage(id);
          router.refresh();
        });
      }}
      className="px-2 py-1 text-red-600 disabled:opacity-50"
    >
      حذف
    </button>
  );
}
