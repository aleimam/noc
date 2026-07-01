'use client';

import { useEffect, useState } from 'react';

// Lightweight global toast: call `toast('...')` from anywhere; a single mounted <Toaster/>
// renders transient confirmations. Used to confirm deletes and other key actions.
type Kind = 'success' | 'error';
type Item = { id: number; text: string; kind: Kind };

export function toast(text: string, kind: Kind = 'success') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('noc-toast', { detail: { text, kind } }));
}

export function Toaster() {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    let seq = 0;
    function on(e: Event) {
      const d = (e as CustomEvent).detail as { text: string; kind: Kind };
      const id = ++seq;
      setItems((p) => [...p, { id, text: d.text, kind: d.kind }]);
      setTimeout(() => setItems((p) => p.filter((x) => x.id !== id)), 2600);
    }
    window.addEventListener('noc-toast', on);
    return () => window.removeEventListener('noc-toast', on);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[200] flex flex-col items-center gap-2" aria-live="polite">
      {items.map((it) => (
        <div key={it.id} className={`rounded-xl px-5 py-3 text-sm font-bold text-white shadow-lg ${it.kind === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
          {it.text}
        </div>
      ))}
    </div>
  );
}
