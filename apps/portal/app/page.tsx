import { useTranslations } from 'next-intl';
import { LanguageSwitcher, ThemeToggle } from '@noc/ui';

export default function Home() {
  const t = useTranslations('common');
  const ta = useTranslations('auth');
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="New Obour Real Estate" className="h-44 w-auto" />
      <h1 className="text-4xl font-bold text-primary">{t('portalName')}</h1>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <a href="/app" className="rounded-md bg-primary px-4 py-2 text-sm text-soft">
          {ta('customerLogin')}
        </a>
        <a
          href="/admin"
          className="rounded-md border border-graphite/25 px-4 py-2 text-sm hover:bg-graphite/10"
        >
          {t('admin')}
        </a>
      </div>

      <div className="flex items-center gap-3">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
    </main>
  );
}
