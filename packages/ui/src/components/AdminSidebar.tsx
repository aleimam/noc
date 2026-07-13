'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import type { AdminNavGroup } from './AdminShell';

const STORAGE_KEY = 'noc.admin.sidebar';

/** Compact monochrome glyph — 24×24, current-color stroke, consistent weight. */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 shrink-0"
      aria-hidden
    >
      {children}
    </svg>
  );
}

/**
 * Icon KEY → inline SVG. Keys are referenced from the caller's nav (`AdminNavItem.icon`);
 * unknown/absent keys fall back to `dot`. Keep glyphs recognizable + single-stroke.
 */
export const ICONS: Record<string, ReactNode> = {
  dashboard: (
    <Icon>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </Icon>
  ),
  search: (
    <Icon>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </Icon>
  ),
  chart: (
    <Icon>
      <path d="M4 3v18h16" />
      <path d="M8 15v-4M12 15V7M16 15v-6" />
    </Icon>
  ),
  sheet: (
    <Icon>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M3 14h18M9 4v16" />
    </Icon>
  ),
  map: (
    <Icon>
      <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" />
      <path d="M9 4v14M15 6v14" />
    </Icon>
  ),
  pin: (
    <Icon>
      <path d="M12 21s7-6.4 7-11a7 7 0 1 0-14 0c0 4.6 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </Icon>
  ),
  store: (
    <Icon>
      <path d="M3 9 4.5 4h15L21 9" />
      <path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" />
      <path d="M9 20v-6h6v6" />
    </Icon>
  ),
  calc: (
    <Icon>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M8 7h8" />
      <path d="M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" />
    </Icon>
  ),
  news: (
    <Icon>
      <path d="M4 5h13v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5Z" />
      <path d="M17 8h3v9a1 1 0 0 1-3 0" />
      <path d="M7 8h7M7 12h7M7 16h4" />
    </Icon>
  ),
  book: (
    <Icon>
      <path d="M5 4a2 2 0 0 1 2-2h12v16H7a2 2 0 0 0-2 2V4Z" />
      <path d="M5 18a2 2 0 0 1 2-2h12" />
    </Icon>
  ),
  doc: (
    <Icon>
      <path d="M6 2h8l4 4v16H6z" />
      <path d="M14 2v4h4" />
      <path d="M9 13h6M9 17h5" />
    </Icon>
  ),
  inbox: (
    <Icon>
      <path d="M4 13 6.5 5h11L20 13" />
      <path d="M4 13v6h16v-6h-5l-1.5 2h-3L9 13H4Z" />
    </Icon>
  ),
  tag: (
    <Icon>
      <path d="M20 12 12 20l-8-8V4h8l8 8Z" />
      <circle cx="8" cy="8" r="1.4" />
    </Icon>
  ),
  list: (
    <Icon>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
    </Icon>
  ),
  grid: (
    <Icon>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </Icon>
  ),
  palette: (
    <Icon>
      <path d="M12 3a9 9 0 1 0 0 18c1 0 1.5-.8 1.5-1.6 0-1 .7-1.4 1.5-1.4H18a3 3 0 0 0 3-3c0-5-4-9-9-9Z" />
      <circle cx="7.5" cy="12" r="1" />
      <circle cx="10" cy="8" r="1" />
      <circle cx="15" cy="8" r="1" />
    </Icon>
  ),
  image: (
    <Icon>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="m3 17 5-4 4 3 3-2 6 5" />
    </Icon>
  ),
  badge: (
    <Icon>
      <circle cx="12" cy="9" r="6" />
      <path d="M9 14.2 8 22l4-2 4 2-1-7.8" />
    </Icon>
  ),
  people: (
    <Icon>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5" />
      <path d="M16 5.5a3.5 3.5 0 0 1 0 6.4" />
      <path d="M18 15c2 .6 3 2.2 3 5" />
    </Icon>
  ),
  user: (
    <Icon>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </Icon>
  ),
  partners: (
    <Icon>
      <circle cx="9" cy="8" r="4" />
      <path d="M2.5 21c0-4 3.5-6 6.5-6s6.5 2 6.5 6" />
      <path d="M19 7v6M16 10h6" />
    </Icon>
  ),
  heart: (
    <Icon>
      <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z" />
    </Icon>
  ),
  toggles: (
    <Icon>
      <path d="M4 8h9M18.5 8H20M4 16h1.5M11 16h9" />
      <circle cx="15.5" cy="8" r="2.3" />
      <circle cx="8.5" cy="16" r="2.3" />
    </Icon>
  ),
  plug: (
    <Icon>
      <path d="M9 2v6M15 2v6" />
      <path d="M7 8h10v3a5 5 0 0 1-10 0V8Z" />
      <path d="M12 16v6" />
    </Icon>
  ),
  shield: (
    <Icon>
      <path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </Icon>
  ),
  gear: (
    <Icon>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
    </Icon>
  ),
  database: (
    <Icon>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
      <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
    </Icon>
  ),
  sell: (
    <Icon>
      <rect x="4" y="4" width="16" height="12" rx="1" />
      <path d="M8 20v-4M16 20v-4" />
      <path d="M8 9h8M8 12h5" />
    </Icon>
  ),
  account: (
    <Icon>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="11" r="2.4" />
      <path d="M14 10h4M14 13.5h4M5 16c.5-1.6 2-2.2 3.5-2.2S11.5 14.4 12 16" />
    </Icon>
  ),
  globe: (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 3.8 5.8 3.8 9S14.5 18.5 12 21C9.5 18.5 8.2 15.2 8.2 12S9.5 5.5 12 3Z" />
    </Icon>
  ),
  dot: (
    <Icon>
      <circle cx="12" cy="12" r="3.5" />
    </Icon>
  ),
};

/**
 * Collapsible admin sidebar (client). Two states: expanded (icon + label, 15rem) and
 * collapsed (icon-only rail, 3.75rem). Owns collapse state, breakpoint default, localStorage
 * persistence, the mobile overlay + backdrop, and the toggle. RTL-aware via logical props.
 */
export function AdminSidebar({
  brand,
  nav,
  collapseLabel,
  expandLabel,
}: {
  brand: string;
  nav: AdminNavGroup[];
  collapseLabel: string;
  expandLabel: string;
}) {
  // SSR + first client render = expanded (no hydration mismatch); corrected on mount below.
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    let next: boolean;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      // Persisted user choice wins; otherwise default from breakpoint (collapsed under lg).
      next =
        stored === 'collapsed' || stored === 'expanded'
          ? stored === 'collapsed'
          : !window.matchMedia('(min-width: 1024px)').matches;
    } catch {
      next = false;
    }
    setCollapsed(next);
  }, []);

  const apply = useCallback((next: boolean, persist = true) => {
    setCollapsed(next);
    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY, next ? 'collapsed' : 'expanded');
      } catch {
        /* ignore quota/availability errors */
      }
    }
  }, []);

  // On mobile, tapping a link (or the backdrop) closes the overlay.
  const closeOnMobile = useCallback(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
      apply(true);
    }
  }, [apply]);

  const toggleLabel = collapsed ? expandLabel : collapseLabel;

  return (
    <>
      {/* Dim backdrop — mobile overlay only. Gated on `mounted` so it never renders on SSR. */}
      {mounted && !collapsed && (
        <button
          type="button"
          aria-hidden
          tabIndex={-1}
          onClick={() => apply(true)}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      <aside
        aria-label={brand}
        className={cn(
          'flex flex-col gap-1 border-e border-graphite/15 bg-navy text-soft',
          'transition-[width] duration-200 ease-out',
          // Desktop: always in-flow grid/flex column.
          'lg:static lg:z-auto lg:shadow-none',
          collapsed
            ? 'w-[3.75rem] static' // rail stays in flow (mobile-acceptable ~60px)
            : 'w-60 fixed inset-y-0 start-0 z-50 shadow-xl', // expanded overlays on mobile
        )}
      >
        {/* Brand + toggle */}
        <div className={cn('flex items-center gap-2 px-2 py-3', collapsed && 'justify-center')}>
          {!collapsed && <span className="flex-1 truncate px-1 text-lg font-bold text-gold">{brand}</span>}
          <button
            type="button"
            onClick={() => apply(!collapsed)}
            aria-label={toggleLabel}
            aria-expanded={!collapsed}
            title={toggleLabel}
            className="rounded-md p-2 text-soft hover:bg-soft/10"
          >
            {collapsed ? (
              // hamburger → "open menu"
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="h-5 w-5" aria-hidden>
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            ) : (
              // double chevron pointing right (») → "collapse" toward the right edge the RTL
              // sidebar is docked on (points the way the panel slides away).
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
                <path d="m11 6 6 6-6 6M6 6l6 6-6 6" />
              </svg>
            )}
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto pb-3">
          {nav.map((group, gi) => (
            <div key={gi} className="flex flex-col gap-0.5">
              {group.title &&
                (collapsed ? (
                  <div className="mx-2 my-1 border-t border-soft/15" aria-hidden />
                ) : (
                  <div className="px-3 pb-1 pt-3 text-xs font-bold uppercase tracking-wide text-gold/70">{group.title}</div>
                ))}
              {group.items.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={closeOnMobile}
                  title={collapsed ? item.label : undefined}
                  aria-label={collapsed ? item.label : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-md py-2 text-sm text-soft/90 hover:bg-soft/10',
                    collapsed ? 'mx-1 justify-center px-0' : 'px-3',
                  )}
                >
                  {ICONS[item.icon ?? 'dot'] ?? ICONS.dot}
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </a>
              ))}
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
