'use client';

import { useTransition } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { toast } from '@noc/ui';
import { setOfferStatus, deleteOffer } from './actions';

const STATUSES: { key: 'NEW' | 'REVIEWING' | 'ACCEPTED' | 'REJECTED'; ar: string; en: string }[] = [
  { key: 'NEW', ar: 'جديد', en: 'New' },
  { key: 'REVIEWING', ar: 'قيد المراجعة', en: 'Reviewing' },
  { key: 'ACCEPTED', ar: 'مقبول', en: 'Accepted' },
  { key: 'REJECTED', ar: 'مرفوض', en: 'Rejected' },
];

export function OfferStatusButtons({ id, current }: { id: string; current: string }) {
  const locale = useLocale() as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap gap-2">
      {STATUSES.map((s) => (
        <button
          key={s.key}
          disabled={pending || current === s.key}
          onClick={() =>
            start(async () => {
              const r = await setOfferStatus(id, s.key);
              if (!r.ok) { toast(L('تعذّر الحفظ', 'Save failed'), 'error'); return; }
              router.refresh();
            })
          }
          className={`rounded-md px-3 py-1.5 text-sm ${current === s.key ? 'bg-primary text-soft' : 'border border-graphite/25 hover:bg-graphite/10'} disabled:opacity-60`}
        >
          {s.ar}
        </button>
      ))}
    </div>
  );
}

export function DeleteOfferButton({ id, redirectTo }: { id: string; redirectTo?: string }) {
  const locale = useLocale() as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!confirm(L('حذف هذا العرض نهائيًا؟ لا يمكن التراجع.', 'Delete this offer permanently? This cannot be undone.'))) return;
        start(async () => {
          const r = await deleteOffer(id);
          if (r.ok) {
            if (redirectTo) router.push(redirectTo);
            else router.refresh();
          } else {
            toast(L('تعذّر الحذف', 'Delete failed'), 'error');
          }
        });
      }}
      className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
    >
      {L('حذف', 'Delete')}
    </button>
  );
}
