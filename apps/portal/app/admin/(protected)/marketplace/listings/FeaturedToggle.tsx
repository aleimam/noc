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
      title={on ? L('مميز — اضغط لإلغاء التمييز', 'Featured — click to unfeature') : L('تمييز', 'Feature')}
      aria-label={on ? L('مميز', 'Featured') : L('تمييز', 'Feature')}
      aria-pressed={on}
      className={`rounded px-2 py-0.5 text-base leading-none ${on ? 'bg-gold-600 text-white' : 'border border-graphite/20 opacity-60'} disabled:opacity-40`}
    >
      ★
    </button>
  );
}
