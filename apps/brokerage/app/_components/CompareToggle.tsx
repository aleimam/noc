'use client';

import { useEffect, useState } from 'react';
import { toast } from '@noc/ui';
import { getCompare, toggleCompare, COMPARE_EVENT } from './compare';

export function CompareToggle({ id, label, locale = 'ar' }: { id: string; label: string; locale?: 'ar' | 'en' }) {
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const sync = () => setOn(getCompare().includes(id));
    sync();
    window.addEventListener(COMPARE_EVENT, sync);
    return () => window.removeEventListener(COMPARE_EVENT, sync);
  }, [id]);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const r = toggleCompare(id);
        if (r === 'full') toast(L('الحد الأقصى ٤ أراضٍ', 'Maximum of 4 lands'), 'error');
        setOn(r === 'added');
      }}
      className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${on ? 'bg-navy-700 text-white' : 'bg-white/90 text-navy-700'} shadow`}
    >
      ⇄ {label}
    </button>
  );
}
