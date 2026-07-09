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
  { href: '/calculator', key: 'calculator' },
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
  copyright,
  tagline,
  mobileMenuMode = 'full',
  loggedIn = false,
  accountLabel = 'حسابي',
  accountHref = '/account',
  partners,
}: {
  children: ReactNode;
  active?: string;
  hiddenKeys?: string[];
  footerPages?: { href: string; label: string }[];
  copyright?: string;
  tagline?: string; // brand slogan under the footer name (falls back to the i18n default)
  mobileMenuMode?: 'full' | 'compact';
  loggedIn?: boolean; // show an account button instead of "login"
  accountLabel?: string;
  accountHref?: string; // where the account button points (customers → /account, partners → /partner)
  partners?: { href: string; label: string }; // optional "Partners" entry (apply / sign in)
}) {
  const t = useTranslations('nav');
  // Logged-in customers/partners get an account icon + label; visitors get the login button.
  const AccountLink = ({ big = false }: { big?: boolean }) =>
    loggedIn ? (
      <a href={accountHref} className={big ? 'mt-2 flex items-center justify-center gap-2 rounded-xl bg-gold px-5 py-4 text-center text-2xl font-bold text-navy-900' : 'flex items-center gap-1.5 rounded-md bg-gold px-3.5 py-2 text-sm font-bold text-navy-900 shadow-gold transition hover:brightness-95'}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>
        {accountLabel}
      </a>
    ) : (
      <a href="/account/login" className={big ? 'mt-2 rounded-xl bg-gold px-5 py-4 text-center text-2xl font-bold text-navy-900' : 'rounded-md bg-gold px-3.5 py-2 text-sm font-bold text-navy-900 shadow-gold transition hover:brightness-95'}>
        {t('login')}
      </a>
    );
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
            {partners && <a href={partners.href} className="hidden rounded-md px-2.5 py-2 text-sm font-semibold text-soft/85 transition-colors hover:text-gold sm:block">{partners.label}</a>}
            <div className="hidden sm:block"><LanguageSwitcher /></div>
            <ThemeToggle />
            <AccountLink />
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label="menu"
              aria-expanded={open}
              className="rounded-lg p-2.5 text-soft hover:bg-white/10 lg:hidden"
            >
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
          </div>
        </div>

        {/* compact dropdown menu */}
        {open && mobileMenuMode === 'compact' && (
          <nav className="border-t border-white/10 px-4 pb-3 lg:hidden">
            {nav.map((n) => (
              <a key={n.href} href={n.href} className="block rounded-md px-3 py-3 text-lg font-semibold text-soft/90 hover:bg-white/10">
                {t(n.key)}
              </a>
            ))}
          </nav>
        )}
      </header>

      {/* full-screen overlay menu (big tap targets) */}
      {open && mobileMenuMode === 'full' && (
        <div className="fixed inset-0 z-50 flex flex-col bg-navy text-soft lg:hidden">
          <div className="flex h-navbar flex-none items-center justify-between gap-4 border-b border-white/10 px-4">
            <span className="text-lg font-extrabold text-gold">{t('brand')}</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="close" className="rounded-lg p-2.5 text-soft hover:bg-white/10">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
          <nav className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
            {nav.map((n) => (
              <a
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'rounded-xl px-5 py-4 text-2xl font-bold text-soft hover:bg-white/10',
                  active === n.key && 'bg-white/10 text-gold',
                )}
              >
                {t(n.key)}
              </a>
            ))}
            {partners && <a href={partners.href} onClick={() => setOpen(false)} className="rounded-xl px-5 py-4 text-2xl font-bold text-soft hover:bg-white/10">{partners.label}</a>}
            <div onClick={() => setOpen(false)}><AccountLink big /></div>
          </nav>
        </div>
      )}

      <main className="flex-1">{children}</main>

      <footer className="border-t border-ink-200 bg-white">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo" alt="" className="h-9 w-auto" />
            <div>
              <div className="text-lg font-extrabold text-navy-800">{t('brand')}</div>
              <div className="text-sm text-ink-500">{tagline || t('tagline')}</div>
            </div>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-base font-medium text-ink-600">
            {nav.map((n) => (
              <a key={n.href} href={n.href} className="hover:text-navy-800">{t(n.key)}</a>
            ))}
            {footerPages.map((p) => (
              <a key={p.href} href={p.href} className="hover:text-navy-800">{p.label}</a>
            ))}
            {partners && <a href={partners.href} className="font-bold text-navy-800 hover:text-gold-700">{partners.label}</a>}
          </nav>
        </div>
        <div className="border-t border-ink-100 py-4 text-center text-xs text-ink-400">{copyright || t('copyright')}</div>
      </footer>
    </div>
  );
}
