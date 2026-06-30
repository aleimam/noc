import { getLocale, getTranslations } from 'next-intl/server';
import { SiteShell } from '../_components/SiteShell';
import { getCalculatorConfig } from '../../lib/calculator/config';
import { CalculatorClient } from './CalculatorClient';

export const dynamic = 'force-dynamic';

export default async function CalculatorPage() {
  const t = await getTranslations('calculator');
  const locale = (await getLocale()) as 'ar' | 'en';
  const config = await getCalculatorConfig();

  return (
    <SiteShell active="calculator">
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
        <div className="pt-2 text-center">
          <h1 className="text-3xl font-black text-navy-800 sm:text-4xl">{t('title')}</h1>
          <p className="mt-2 text-lg text-ink-600">{t('subtitle')}</p>
        </div>
        <CalculatorClient config={config} locale={locale} />
      </div>
    </SiteShell>
  );
}
