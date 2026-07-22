'use client';

import { useState, useTransition } from 'react';
import { runAction } from '@/app/admin/(protected)/runAction';
import { toggleFeatured } from '../actions';
import { useLocale } from 'next-intl';

export function FeaturedToggle({ id, initial }: { id: string; initial: boolean }) {
  const locale = useLocale() as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const next = !on;
          setOn(next);
          const ok = await runAction(() => toggleFeatured(id, next), { errorText: L('تعذّر الحفظ', 'Save failed') });
          if (!ok) setOn(!next); // revert the optimistic flip
        })
      }
      title={L('مميز', 'Featured')}
      className={`rounded px-2 py-0.5 text-sm ${on ? 'bg-gold-600 text-white' : 'border border-graphite/20 opacity-60'} disabled:opacity-40`}
    >
      ★ {on ? L('مميز', 'Featured') : L('تمييز', 'Feature')}
    </button>
  );
}
