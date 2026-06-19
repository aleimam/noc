import { useTranslations } from 'next-intl';
import { LanguageSwitcher, ThemeToggle } from '@noc/ui';

export default function Home() {
  const t = useTranslations('common');
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-navy p-8 text-center text-soft">
      <h1 className="text-4xl font-bold text-gold">{t('brokerageName')}</h1>
      <p className="text-lg opacity-80">alsawarey.com · :3002</p>
      <div className="flex items-center gap-3">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
    </main>
  );
}
