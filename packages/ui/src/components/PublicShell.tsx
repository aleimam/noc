'use client';

import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '../lib/cn';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';

const NAV = [
  { href: '/', key: 'home' },
  { href: '/market', key: 'market' },
  { href: '/explore', key: 'explore' },
  { href: '/rationing', key: 'rationing' },
  { href: '/news', key: 'news' },
  { href: '/guide', key: 'guide' },
  { href: '/price-index', key: 'priceIndex' },
] as const;

/** Public chrome for newobour.com — sticky navy navbar (logo, sections, language/theme,
 *  login) + footer. Wrap a public page's content in it; `active` highlights the section. */
export function PublicShell({
  children,
  active,
  hiddenKeys = [],
  footerPages = [],
}: {
  children: ReactNode;
  active?: string;
  hiddenKeys?: string[];
  footerPages?: { href: string; label: string }[];
}) {
  const t = useTranslations('nav');
  const nav = NAV.filter((n) => !hiddenKeys.includes(n.key));
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-soft">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-navy text-soft">
        <div className="mx-auto flex h-navbar max-w-[1320px] items-center justify-between gap-4 px-4 sm:px-6">
          <a href="/" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo" alt="" className="h-9 w-auto" />
            <span className="text-lg font-extrabold text-gold">{t('brand')}</span>
          </a>

          <nav className="hidden items-center gap-0.5 lg:flex">
            {nav.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-semibold text-soft/85 transition-colors hover:text-gold',
                  active === n.key && 'text-gold',
                )}
              >
                {t(n.key)}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden sm:block"><LanguageSwitcher /></div>
            <ThemeToggle />
            <a href="/app" className="rounded-md bg-gold px-3.5 py-2 text-sm font-bold text-navy-900 shadow-gold transition hover:brightness-95">
              {t('login')}
            </a>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label="menu"
              className="rounded-md p-2 text-soft/90 hover:bg-white/10 lg:hidden"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
          </div>
        </div>

        {open && (
          <nav className="border-t border-white/10 px-4 pb-3 lg:hidden">
            {nav.map((n) => (
              <a key={n.href} href={n.href} className="block rounded-md px-3 py-2.5 text-sm font-semibold text-soft/90 hover:bg-white/10">
                {t(n.key)}
              </a>
            ))}
          </nav>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-ink-200 bg-white">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo" alt="" className="h-10 w-auto" />
            <div>
              <div className="font-extrabold text-navy-800">{t('brand')}</div>
              <div className="text-xs text-ink-500">{t('tagline')}</div>
            </div>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-600">
            {nav.map((n) => (
              <a key={n.href} href={n.href} className="hover:text-navy-800">{t(n.key)}</a>
            ))}
            {footerPages.map((p) => (
              <a key={p.href} href={p.href} className="hover:text-navy-800">{p.label}</a>
            ))}
          </nav>
        </div>
        <div className="border-t border-ink-100 py-4 text-center text-xs text-ink-400">{t('copyright')}</div>
      </footer>
    </div>
  );
}
