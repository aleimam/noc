import type { ReactNode } from 'react';
import { LanguageSwitcher } from './LanguageSwitcher';
import { AdminSidebar } from './AdminSidebar';
import { RecentFeaturesTracker } from './RecentFeatures';

export interface AdminNavItem {
  href: string;
  label: string;
  /** Icon KEY resolved by AdminSidebar's ICONS map (unknown/absent → `dot`). */
  icon?: string;
}

export interface AdminNavGroup {
  title?: string;
  items: AdminNavItem[];
}

/**
 * Admin chrome: a navy sidebar (nav is permission-filtered + grouped by the caller)
 * plus a topbar with the signed-in user, language + theme switchers, a back-to-site
 * link, and a sign-out slot. RTL-aware via logical properties.
 */
export function AdminShell({
  brand,
  userLabel,
  nav,
  backToSiteLabel,
  storeLinks,
  signOut,
  search,
  quickAction,
  recentKey,
  collapseLabel = 'Collapse menu',
  expandLabel = 'Expand menu',
  children,
}: {
  brand: string;
  userLabel: string;
  nav: AdminNavGroup[];
  backToSiteLabel: string;
  storeLinks?: { label: string; href: string }[];
  signOut?: ReactNode;
  /** Optional global-search box rendered in the topbar. */
  search?: ReactNode;
  /** Always-visible primary action in the topbar (e.g. «+ إضافة عرض») — permission-gated by the caller. */
  quickAction?: { label: string; href: string };
  /** STAFF user id: records visited features per user for the dashboard's recently-used grid. */
  recentKey?: string;
  /** aria-label/tooltip for the sidebar toggle (pass localized copy). */
  collapseLabel?: string;
  expandLabel?: string;
  children: ReactNode;
}) {
  // Flex layout: the sidebar owns its own width (rail vs 15rem, or a fixed mobile overlay),
  // and the content column simply fills whatever space is left — so it adapts to collapse
  // without a hardcoded column width.
  return (
    <div className="flex min-h-screen">
      {recentKey && <RecentFeaturesTracker nav={nav} userKey={recentKey} />}
      <AdminSidebar brand={brand} nav={nav} collapseLabel={collapseLabel} expandLabel={expandLabel} />

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-graphite/15 px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {search && <div className="min-w-0 flex-1">{search}</div>}
            <span className="hidden shrink-0 text-sm opacity-80 lg:inline">{userLabel}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {quickAction && (
              <a
                href={quickAction.href}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-bold text-soft shadow-sm hover:opacity-90"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" className="h-4 w-4" aria-hidden>
                  <path d="M12 5v14M5 12h14" />
                </svg>
                {quickAction.label}
              </a>
            )}
            <LanguageSwitcher />
            {(storeLinks ?? [{ label: backToSiteLabel, href: '/' }]).map((s) => (
              <a
                key={s.href}
                href={s.href}
                target={s.href.startsWith('http') ? '_blank' : undefined}
                rel={s.href.startsWith('http') ? 'noreferrer' : undefined}
                className="inline-flex items-center gap-1 rounded-md border border-graphite/20 px-3 py-1.5 text-sm hover:bg-graphite/10"
              >
                <span aria-hidden>🏬</span> {s.label}
              </a>
            ))}
            {signOut}
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
