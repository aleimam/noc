'use client';

import { useEffect, useState } from 'react';

// Client-only "recently viewed" — we store a small card snapshot in localStorage at view
// time, so the row renders with zero server round-trips and works on either site (each
// domain keeps its own list). Key is per-brand to avoid cross-site mixing.
export type ViewedItem = { id: string; title: string; cover?: string | null; price?: string | null; href: string };

const KEY = 'noc_viewed';
const CAP = 24;

function read(): ViewedItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as ViewedItem[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** Records the listing as viewed (most-recent-first, de-duplicated). Renders nothing. */
export function TrackView({ item }: { item: ViewedItem }) {
  useEffect(() => {
    try {
      const next = [item, ...read().filter((x) => x.id !== item.id)].slice(0, CAP);
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore quota/availability errors */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);
  return null;
}

/** Price snapshots are stored raw (e.g. "1500000") — format with thousands separators. */
function fmtPrice(p: string): string {
  const n = Number(String(p).replace(/,/g, ''));
  return Number.isFinite(n) ? n.toLocaleString('en-US') : p;
}

/** Horizontal "recently viewed" row, excluding the current listing. Hidden when empty.
 *  On mount it asks the server which stored ids still exist (POST /api/listings/alive) and
 *  PRUNES any listing that was deleted/unpublished from localStorage — so a trashed listing
 *  never lingers as a blank dead card. Renders nothing until validated (no flash of dead cards);
 *  if the check fails (offline) it falls back to the stored list. */
export function RecentlyViewed({ title, excludeId, currency = 'ج.م' }: { title: string; excludeId?: string; currency?: string }) {
  const [items, setItems] = useState<ViewedItem[] | null>(null);
  useEffect(() => {
    const stored = read();
    if (stored.length === 0) {
      setItems([]);
      return;
    }
    let cancelled = false;
    (async () => {
      let live = stored;
      try {
        const res = await fetch('/api/listings/alive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: stored.map((x) => x.id) }),
        });
        if (res.ok) {
          const data = (await res.json()) as { alive?: string[] };
          const alive = new Set(data.alive ?? []);
          live = stored.filter((x) => alive.has(x.id));
          localStorage.setItem(KEY, JSON.stringify(live)); // permanently drop dead entries
        }
      } catch {
        /* offline / error → keep the stored list rather than blanking the row */
      }
      if (!cancelled) setItems(live);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const shown = (items ?? []).filter((x) => x.id !== excludeId);
  if (shown.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-navy-800 dark:text-soft">{title}</h2>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
        {shown.map((it) => (
          <a key={it.id} href={it.href} className="w-40 flex-none overflow-hidden rounded-lg border border-ink-200 bg-white shadow-sm transition hover:shadow-md dark:bg-navy-800">
            <div className="aspect-[16/10] bg-navy-100 dark:bg-navy-900">
              {it.cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.cover} alt={it.title} className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="p-2">
              <div className="truncate text-sm font-bold text-navy-800 dark:text-soft">{it.title}</div>
              {it.price && (
                <div className="text-sm font-bold text-navy-800 dark:text-soft">
                  <span className="font-num" dir="ltr">{fmtPrice(it.price)}</span>{' '}
                  <span className="text-xs font-semibold text-ink-500">{currency}</span>
                </div>
              )}
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
