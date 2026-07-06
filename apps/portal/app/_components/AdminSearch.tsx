'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { AdminSearchHit } from '../admin/(protected)/search-actions';

type Hit = AdminSearchHit;
type PageItem = { label: string; href: string };

// Fixed group order in the dropdown. 'page' = admin nav/modules (searched client-side);
// the rest come from the permission-checked server action.
const ORDER = ['page', 'attribute', 'classifier', 'option', 'section', 'optionList', 'amenity', 'condition'] as const;

export function AdminSearch({
  pages,
  action,
}: {
  pages: PageItem[];
  action: (q: string) => Promise<Hit[]>;
}) {
  const t = useTranslations('admin');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [dbHits, setDbHits] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Client-side page/module matches (nav is already permission-filtered by the caller).
  const pageHits: Hit[] = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return pages.filter((p) => p.label.toLowerCase().includes(s)).slice(0, 8).map((p) => ({ type: 'page', label: p.label, href: p.href }));
  }, [q, pages]);

  // Debounced DB search for config records (attributes, classifiers, …).
  useEffect(() => {
    const s = q.trim();
    if (s.length < 2) { setDbHits([]); return; }
    let alive = true;
    const h = setTimeout(async () => {
      try {
        const r = await action(s);
        if (alive) setDbHits(r);
      } catch { if (alive) setDbHits([]); }
    }, 200);
    return () => { alive = false; clearTimeout(h); };
  }, [q, action]);

  const all = useMemo(() => [...pageHits, ...dbHits], [pageHits, dbHits]);
  useEffect(() => { setActive(0); }, [all.length]);

  // Group for rendering, preserving ORDER.
  const groups = useMemo(() => {
    const by = new Map<string, Hit[]>();
    for (const h of all) (by.get(h.type) ?? by.set(h.type, []).get(h.type)!).push(h);
    return ORDER.filter((k) => by.has(k)).map((k) => ({ key: k, items: by.get(k)! }));
  }, [all]);

  // Cmd/Ctrl+K focuses the box from anywhere in the admin.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Close on outside click.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function go(href: string) {
    setOpen(false);
    setQ('');
    window.location.href = href;
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); return; }
    if (!all.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % all.length); setOpen(true); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i - 1 + all.length) % all.length); }
    else if (e.key === 'Enter') { e.preventDefault(); const h = all[active]; if (h) go(h.href); }
  }

  const grp = (k: string) => t(`grp_${k}` as never);
  // Flat index bookkeeping so arrow-key highlight lines up across grouped rendering.
  let flatIndex = -1;

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <div className="flex items-center gap-2 rounded-md border border-graphite/25 bg-white px-3 py-1.5">
        <span aria-hidden className="text-graphite/50">🔎</span>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={t('searchPlaceholder')}
          className="w-full bg-transparent text-sm outline-none"
          dir="auto"
          aria-label={t('searchPlaceholder')}
        />
        <kbd className="hidden shrink-0 rounded border border-graphite/25 px-1.5 text-[10px] text-graphite/50 sm:block">Ctrl K</kbd>
      </div>

      {open && q.trim().length > 0 && (
        <div className="absolute z-50 mt-1 max-h-[70vh] w-full overflow-auto rounded-lg border border-graphite/20 bg-white py-1 shadow-xl">
          {all.length === 0 && <div className="px-3 py-3 text-sm text-graphite/60">{t('searchNoResults')}</div>}
          {groups.map((g) => (
            <div key={g.key}>
              <div className="px-3 pb-0.5 pt-2 text-[11px] font-bold uppercase tracking-wide text-graphite/50">{grp(g.key)}</div>
              {g.items.map((h) => {
                flatIndex += 1;
                const idx = flatIndex;
                return (
                  <button
                    key={`${h.type}:${h.href}:${idx}`}
                    type="button"
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => go(h.href)}
                    className={`block w-full px-3 py-1.5 text-start text-sm ${idx === active ? 'bg-navy/10' : 'hover:bg-graphite/5'}`}
                    dir="auto"
                  >
                    {h.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
