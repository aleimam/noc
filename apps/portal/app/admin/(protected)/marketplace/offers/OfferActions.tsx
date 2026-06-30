'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setOfferStatus } from './actions';

const STATUSES: { key: 'NEW' | 'REVIEWING' | 'ACCEPTED' | 'REJECTED'; ar: string }[] = [
  { key: 'NEW', ar: 'جديد' },
  { key: 'REVIEWING', ar: 'قيد المراجعة' },
  { key: 'ACCEPTED', ar: 'مقبول' },
  { key: 'REJECTED', ar: 'مرفوض' },
];

export function OfferStatusButtons({ id, current }: { id: string; current: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap gap-2">
      {STATUSES.map((s) => (
        <button
          key={s.key}
          disabled={pending || current === s.key}
          onClick={() => start(async () => { await setOfferStatus(id, s.key); router.refresh(); })}
          className={`rounded-md px-3 py-1.5 text-sm ${current === s.key ? 'bg-primary text-soft' : 'border border-graphite/25 hover:bg-graphite/10'} disabled:opacity-60`}
        >
          {s.ar}
        </button>
      ))}
    </div>
  );
}
