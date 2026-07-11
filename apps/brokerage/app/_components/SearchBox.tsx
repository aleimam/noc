'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function SearchBox({ placeholder, initial = '' }: { placeholder: string; initial?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`/listings?q=${encodeURIComponent(q.trim())}`);
      }}
      className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5"
    >
      {/* Real submit button — the glyph is tappable, not just decoration. */}
      <button type="submit" aria-label={placeholder} className="text-white/70 hover:text-white">⌕</button>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className="w-36 bg-transparent text-sm text-white placeholder:text-white/60 outline-none sm:w-48"
        aria-label={placeholder}
      />
    </form>
  );
}
