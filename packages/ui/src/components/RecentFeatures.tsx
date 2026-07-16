'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { AdminNavGroup, AdminNavItem } from './AdminShell';
import { ICONS } from './AdminSidebar';

// Per-user "recently used features" for the admin dashboard. The tracker (mounted in
// AdminShell) matches the current path against the permission-filtered nav and records
// {href,label,icon} in localStorage keyed by the STAFF user id; the grid (dashboard)
// renders up to 8 one-tap tiles. Device-local by design — no schema, instant.

type Recent = { href: string; label: string; icon?: string };
const MAX = 8;
const keyFor = (userKey: string) => `noc_admin_recent_${userKey}`;

function read(userKey: string): Recent[] {
  try {
    const raw = localStorage.getItem(keyFor(userKey));
    const arr = raw ? (JSON.parse(raw) as Recent[]) : [];
    return Array.isArray(arr) ? arr.filter((r) => r && typeof r.href === 'string' && typeof r.label === 'string') : [];
  } catch {
    return [];
  }
}

/** Invisible: records the visited feature (best/longest nav-href prefix match) per user. */
export function RecentFeaturesTracker({ nav, userKey }: { nav: AdminNavGroup[]; userKey: string }) {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname || !pathname.startsWith('/admin') || pathname === '/admin') return;
    let best: AdminNavItem | null = null;
    for (const g of nav)
      for (const it of g.items) {
        if (it.href === '/admin') continue;
        if (pathname === it.href || pathname.startsWith(`${it.href}/`)) {
          if (!best || it.href.length > best.href.length) best = it;
        }
      }
    if (!best) return;
    try {
      const rest = read(userKey).filter((r) => r.href !== best!.href);
      const next = [{ href: best.href, label: best.label, icon: best.icon }, ...rest].slice(0, MAX);
      localStorage.setItem(keyFor(userKey), JSON.stringify(next));
    } catch {
      /* storage unavailable — feature is best-effort */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, userKey]);
  return null;
}

/** Dashboard grid: up to 8 one-tap tiles for this user's recently used features. */
export function RecentFeaturesGrid({ userKey, title, emptyHint }: { userKey: string; title: string; emptyHint: string }) {
  const [items, setItems] = useState<Recent[] | null>(null); // null until mounted (SSR-safe)
  useEffect(() => {
    setItems(read(userKey));
  }, [userKey]);
  if (items === null) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-bold text-primary">⚡ {title}</h2>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-graphite/25 p-4 text-xs opacity-60">{emptyHint}</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          {items.map((r) => (
            <a
              key={r.href}
              href={r.href}
              className="group flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl border border-graphite/15 bg-white p-2 text-center transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-md dark:bg-navy-800"
            >
              <span className="text-primary transition-transform group-hover:scale-110 dark:text-soft">{ICONS[r.icon ?? ''] ?? ICONS.dot}</span>
              <span className="text-xs font-semibold leading-tight">{r.label}</span>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
