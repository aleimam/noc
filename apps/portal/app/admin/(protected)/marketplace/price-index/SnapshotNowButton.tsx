'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@noc/ui';
import { snapshotPricesNow } from '../actions';

export function SnapshotNowButton({ locale }: { locale: 'ar' | 'en' }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  function run() {
    start(async () => {
      const r = await snapshotPricesNow();
      if (r.ok) {
        const count = 'count' in r ? r.count : 0;
        toast(count ? L(`تم تسجيل لقطة لـ ${count} حي`, `Snapshot saved for ${count} districts`) : L('لا توجد أسعار منشورة لتسجيلها بعد', 'No published prices to snapshot yet'));
        router.refresh();
      } else toast(L('تعذّر التسجيل', 'Snapshot failed'), 'error');
    });
  }
  return (
    <button type="button" onClick={run} disabled={pending} className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-soft disabled:opacity-50">
      {pending ? L('جارٍ التسجيل…', 'Snapshotting…') : L('📸 تسجيل لقطة الآن', '📸 Snapshot now')}
    </button>
  );
}
