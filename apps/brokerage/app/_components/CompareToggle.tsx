'use client';

import { useEffect, useState } from 'react';
import { getCompare, toggleCompare, COMPARE_EVENT } from './compare';

export function CompareToggle({ id, label }: { id: string; label: string }) {
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
        setOn(toggleCompare(id));
      }}
      className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${on ? 'bg-navy-700 text-white' : 'bg-white/90 text-navy-700'} shadow`}
    >
      ⇄ {label}
    </button>
  );
}
