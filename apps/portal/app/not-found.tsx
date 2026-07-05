import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import type { Locale } from '@noc/i18n';
import { SiteShell } from './_components/SiteShell';
import { getModuleVisibility, type ModuleKey } from '../lib/modules';

// Branded 404 for newobour.com. Wrapped in SiteShell so it keeps the full nav + footer,
// and offers a big home button plus the main sections (helpful on mobile where the nav
// is behind the menu button). See MEMORY: golden-rule-low-tech-users.
const SECTIONS: { href: string; key: ModuleKey; ar: string; en: string }[] = [
  { href: '/rationing', key: 'rationing', ar: 'كشوف التقنين', en: 'Rationing lists' },
  { href: '/explore', key: 'explore', ar: 'استكشاف الأحياء', en: 'Explore neighborhoods' },
  { href: '/calculator', key: 'calculator', ar: 'الحاسبات', en: 'Calculators' },
  { href: '/market', key: 'market', ar: 'السوق', en: 'Marketplace' },
];

export default async function NotFound() {
  const locale = (await getLocale()) as Locale;
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const vis = await getModuleVisibility();
  const sections = SECTIONS.filter((s) => vis[s.key] !== false);

  return (
    <SiteShell>
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
        {sections.length > 0 && (
          <div className="grid w-full grid-cols-2 gap-3 pt-2">
            {sections.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="rounded-xl border border-ink-200 bg-white p-4 font-bold text-navy-800 transition hover:border-gold hover:shadow-md dark:border-white/10 dark:bg-navy-800 dark:text-soft"
              >
                {L(s.ar, s.en)}
              </Link>
            ))}
          </div>
        )}
      </div>
    </SiteShell>
  );
}
