'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCompare, clearCompare, COMPARE_EVENT } from './compare';

export function CompareBar({ labels }: { labels: { compare: string; clear: string; items: string } }) {
  const router = useRouter();
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    const sync = () => setIds(getCompare());
    sync();
    window.addEventListener(COMPARE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(COMPARE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  if (ids.length === 0) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-navy-800 text-white shadow-lg">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
        <span className="text-sm">{ids.length} {labels.items}</span>
        <div className="flex items-center gap-2">
          <button onClick={() => clearCompare()} className="rounded-lg px-3 py-1.5 text-sm text-white/70 hover:text-white">{labels.clear}</button>
          <button onClick={() => router.push(`/market/compare?ids=${ids.join(',')}`)} disabled={ids.length < 2} className="rounded-lg bg-gold px-4 py-1.5 text-sm font-bold text-navy-900 disabled:opacity-50">{labels.compare}</button>
        </div>
      </div>
    </div>
  );
}
