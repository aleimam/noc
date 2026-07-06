import type { ReactNode } from 'react';
import { LanguageSwitcher } from './LanguageSwitcher';

export interface AdminNavItem {
  href: string;
  label: string;
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
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-screen grid-cols-[15rem_1fr]">
      <aside className="flex flex-col gap-1 border-e border-graphite/15 bg-navy p-3 text-soft">
        <div className="px-2 py-3 text-lg font-bold text-gold">{brand}</div>
        <nav className="flex flex-col gap-1">
          {nav.map((group, gi) => (
            <div key={gi} className="flex flex-col gap-0.5">
              {group.title && (
                <div className="px-3 pb-1 pt-3 text-xs font-bold uppercase tracking-wide text-gold/70">{group.title}</div>
              )}
              {group.items.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-2 text-sm text-soft/90 hover:bg-soft/10"
                >
                  {item.label}
                </a>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex min-h-screen flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-graphite/15 px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {search && <div className="min-w-0 flex-1">{search}</div>}
            <span className="hidden shrink-0 text-sm opacity-80 lg:inline">{userLabel}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
