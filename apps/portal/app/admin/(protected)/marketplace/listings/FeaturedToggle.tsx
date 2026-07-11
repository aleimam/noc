'use client';

import { useState, useTransition } from 'react';
import { runAction } from '@/app/admin/(protected)/runAction';
import { toggleFeatured } from '../actions';

export function FeaturedToggle({ id, initial }: { id: string; initial: boolean }) {
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
          const ok = await runAction(() => toggleFeatured(id, next), { errorText: 'تعذّر الحفظ / Save failed' });
          if (!ok) setOn(!next); // revert the optimistic flip
        })
      }
      title="مميز"
      className={`rounded px-2 py-0.5 text-sm ${on ? 'bg-gold-600 text-white' : 'border border-graphite/20 opacity-60'} disabled:opacity-40`}
    >
      ★ {on ? 'مميز' : 'تمييز'}
    </button>
  );
}
