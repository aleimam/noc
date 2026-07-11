'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LanguageSwitcher, ThemeToggle } from '@noc/ui';

type Item = { label: string; href: string };
type Group = { title: string; links: Item[] };

// Full-screen, big-tap-target mobile menu for Al Sawarey (Golden Rule). The desktop nav is
// hidden on phones, so this is the only navigation there.
export function StoreMobileMenu({
  allLands,
  featured,
  sell,
  groups,
  account,
  wishlist,
  brand,
  locale = 'ar',
}: {
  allLands: Item;
  featured: Item;
  sell: Item;
  groups: Group[];
  account: Item;
  wishlist: Item;
  brand: string;
  locale?: 'ar' | 'en';
}) {
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const [open, setOpen] = useState(false);
  const Row = ({ href, label, accent }: { href: string; label: string; accent?: boolean }) => (
    <Link href={href} onClick={() => setOpen(false)} className={`block rounded-xl px-5 py-4 text-2xl font-bold hover:bg-white/10 ${accent ? 'text-gold' : 'text-soft'}`}>
      {label}
    </Link>
  );

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={L('القائمة', 'Menu')} className="rounded-lg p-2.5 text-white hover:bg-white/10 md:hidden">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-navy-800 text-soft md:hidden">
          <div className="flex h-16 flex-none items-center justify-between border-b border-white/10 px-4">
            <span className="text-lg font-extrabold text-gold">{brand}</span>
            <button type="button" onClick={() => setOpen(false)} aria-label={L('إغلاق', 'Close')} className="rounded-lg p-2.5 hover:bg-white/10">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto p-3">
            <Row href={allLands.href} label={allLands.label} />
            <Row href={featured.href} label={`★ ${featured.label}`} accent />
            {groups.map((g, gi) => (
              <div key={gi} className="mt-2">
                <div className="px-5 pb-1 pt-3 text-sm font-bold uppercase tracking-wide text-gold/70">{g.title}</div>
                {g.links.map((l, li) => (
                  <Row key={li} href={l.href} label={l.label} />
                ))}
              </div>
            ))}
            <Row href={sell.href} label={sell.label} accent />
            <div className="my-2 border-t border-white/10" />
            <Row href={wishlist.href} label={`♥ ${wishlist.label}`} />
            <Row href={account.href} label={account.label} />
            <div className="flex items-center gap-3 px-5 py-4"><LanguageSwitcher /><ThemeToggle /></div>
          </nav>
        </div>
      )}
    </>
  );
}
