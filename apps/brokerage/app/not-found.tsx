import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import type { Locale } from '@noc/i18n';
import { StoreShell } from './_components/StoreShell';
import { getStorefront } from '../lib/storefront';

// Branded 404 for alsawarey.com. Wrapped in StoreShell so it keeps the store nav + footer,
// with a big home button plus the main sections. See MEMORY: golden-rule-low-tech-users.
export default async function NotFound() {
  const locale = (await getLocale()) as Locale;
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const Lc = (t: { ar: string; en: string }) => (locale === 'ar' ? t.ar : t.en);
  const content = await getStorefront();
  const sections = [
    { href: content.nav.allLands.href, label: Lc(content.nav.allLands.label) },
    { href: content.nav.sell.href, label: Lc(content.nav.sell.label) },
    { href: '/wishlist', label: L('المفضلة', 'Wishlist') },
  ];

  return (
    <StoreShell>
      <div className="mx-auto flex max-w-xl flex-col items-center gap-6 px-4 py-16 text-center sm:py-24">
        <div className="font-num text-7xl font-black text-gold">404</div>
        <h1 className="text-2xl font-black text-navy-800 dark:text-soft sm:text-3xl">
          {L('الصفحة غير موجودة', 'Page not found')}
        </h1>
        <p className="text-lg text-navy-600 dark:text-soft/70">
          {L('عذرًا، الصفحة التي تبحث عنها غير متوفرة أو تم نقلها.', 'Sorry, the page you are looking for is unavailable or was moved.')}
        </p>
        <Link
          href="/"
          className="rounded-xl bg-gold px-6 py-4 text-lg font-bold text-navy-900 shadow-gold transition hover:brightness-95"
        >
          {L('الصفحة الرئيسية', 'Back to home')}
        </Link>
        <div className="grid w-full grid-cols-1 gap-3 pt-2 sm:grid-cols-3">
          {sections.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="rounded-xl border border-ink-200 bg-white p-4 font-bold text-navy-800 transition hover:border-gold hover:shadow-md dark:border-white/10 dark:bg-navy-800 dark:text-soft"
            >
              {s.label}
            </Link>
          ))}
        </div>
      </div>
    </StoreShell>
  );
}
