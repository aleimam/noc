'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';

// Search Intelligence S3c — instant search box with a suggestions dropdown. Self-contained:
// debounced fetch to the app's /api/search-suggest (relative → works on both sites), keyboard nav,
// outside-click close. Navigating from a picked suggestion adds &fast=1 so the results page can log
// usedFastSearch. `extraParams` preserves the current facet filters (type, etc.) on navigate.

type Suggestion = { text: string; kind: 'trending' | 'type' | 'district' | 'neighborhood' };

const KIND_ICON: Record<Suggestion['kind'], string> = { trending: '🔥', type: '🏠', district: '📍', neighborhood: '📍' };

export function SearchAutocomplete({
  action,
  initialQuery = '',
  placeholder,
  className = '',
  inputClassName,
  buttonClassName,
  extraParams = {},
  locale = 'ar',
}: {
  /** Path to submit to, e.g. '/market' or '/listings'. */
  action: string;
  initialQuery?: string;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  buttonClassName?: string;
  extraParams?: Record<string, string>;
  locale?: 'ar' | 'en';
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const acRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    const id = setTimeout(() => {
      acRef.current?.abort();
      const ac = new AbortController();
      acRef.current = ac;
      fetch(`/api/search-suggest?q=${encodeURIComponent(term)}`, { signal: ac.signal })
        .then((r) => r.json())
        .then((j: { suggestions?: Suggestion[] }) => setSuggestions(Array.isArray(j?.suggestions) ? j.suggestions : []))
        .catch(() => {});
    }, 220);
    return () => clearTimeout(id);
  }, [q, open]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function go(term: string, fast: boolean) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(extraParams)) if (v) p.set(k, v);
    const t = term.trim();
    if (t) p.set('q', t);
    if (fast) p.set('fast', '1');
    setOpen(false);
    router.push(`${action}${p.toString() ? `?${p.toString()}` : ''}`);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return; // Enter handled by the form submit
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, -1)); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); go(suggestions[active]!.text, true); }
    else if (e.key === 'Escape') setOpen(false);
  }

  const baseInput = inputClassName ?? 'w-full rounded-full border border-graphite/25 bg-white/90 px-4 py-2.5 text-base text-ink-900 outline-none focus:border-accent';

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <form onSubmit={(e) => { e.preventDefault(); go(q, false); }} className="flex items-center gap-2" role="search">
        <input
          type="search"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label={placeholder}
          autoComplete="off"
          className={baseInput}
          dir="auto"
        />
        <button type="submit" aria-label={locale === 'ar' ? 'بحث' : 'Search'} className={buttonClassName ?? 'shrink-0 rounded-full bg-primary px-4 py-2.5 text-soft'}>🔍</button>
      </form>
      {open && suggestions.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-50 mt-1 max-h-80 overflow-auto rounded-xl border border-graphite/20 bg-white py-1 shadow-lg">
          {suggestions.map((s, i) => (
            <li key={`${s.text}-${i}`}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); go(s.text, true); }}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center gap-2 px-4 py-2 text-start text-base ${active === i ? 'bg-graphite/10' : ''}`}
                dir="auto"
              >
                <span aria-hidden>{KIND_ICON[s.kind]}</span>
                <span className="truncate text-ink-900">{s.text}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
