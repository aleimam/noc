'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function AccountTabs({ tabs }: { tabs: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav className="-mb-px flex flex-wrap gap-1 overflow-x-auto">
      {tabs.map((tab) => {
        const active = tab.href === '/account' ? path === '/account' : path.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-bold transition-colors ${
              active
                ? 'border-accent text-primary'
                : 'border-transparent text-ink-500 hover:text-primary'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
