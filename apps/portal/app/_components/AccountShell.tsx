import type { ReactNode } from 'react';
import Link from 'next/link';
import { SignOutButton } from './SignOutButton';
import { AccountTabs } from './AccountTabs';

// Shared chrome for the logged-in customer area: brand, back-to-site, sign out, and a
// tab bar across the account sections. Individual pages render only their own content.
export function AccountShell({
  brand,
  backLabel,
  tabs,
  children,
}: {
  brand: string;
  backLabel: string;
  tabs: { href: string; label: string }[];
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="border-b border-ink-200 bg-bg">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3.5">
          <Link href="/account" className="text-lg font-black text-primary">{brand}</Link>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-accent">{backLabel}</Link>
            <SignOutButton />
          </div>
        </div>
        <div className="mx-auto max-w-3xl px-4">
          <AccountTabs tabs={tabs} />
        </div>
      </header>
      <main className="mx-auto max-w-3xl p-4 sm:p-6">{children}</main>
    </div>
  );
}
