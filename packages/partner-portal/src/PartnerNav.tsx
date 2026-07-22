'use client';

import { usePathname } from 'next/navigation';

export type PartnerNavItem = { href: string; label: string };

/** Partner-portal sub-nav, SHARED by both apps so the tabs can't drift apart (the two layouts
 *  previously duplicated this markup and the house rule was "change both together").
 *
 *  Highlights the current tab — without it every tab looked identical and a partner had no idea
 *  which page they were on. Matching rule: the dashboard `/partner` is EXACT-match only, because
 *  every other href starts with it and it would otherwise light up permanently. */
export function PartnerNav({ items, tone = 'navy' }: { items: PartnerNavItem[]; tone?: 'navy' | 'plain' }) {
  const pathname = usePathname() || '';
  const isActive = (href: string) =>
    href === '/partner' ? pathname === '/partner' : pathname === href || pathname.startsWith(href + '/');

  return (
    <>
      {items.map((n) => {
        const active = isActive(n.href);
        return (
          <a
            key={n.href}
            href={n.href}
            aria-current={active ? 'page' : undefined}
            className={
              active
                ? 'rounded-md bg-gold px-3 py-2 font-bold text-navy-900 shadow-sm'
                : tone === 'navy'
                  ? 'rounded-md px-3 py-2 hover:bg-white/10 hover:text-gold-300'
                  : 'rounded-md px-3 py-2 hover:text-gold-300'
            }
          >
            {n.label}
          </a>
        );
      })}
    </>
  );
}
