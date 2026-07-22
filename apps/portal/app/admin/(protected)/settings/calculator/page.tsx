import { getLocale } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { getCalculatorConfig } from '../../../../../lib/calculator/config';
import { CalculatorSettingsClient } from './CalculatorSettingsClient';

export const dynamic = 'force-dynamic';

export default async function CalculatorSettingsPage() {
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  await requirePermission('settings', 'VIEW');
  const config = await getCalculatorConfig();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{L('حساب التسوية', 'Reconciliation calculator')}</h1>
        <a href="/admin/settings" className="text-sm text-accent">{L('← الإعدادات', '← Settings')}</a>
      </div>
      <p className="text-sm opacity-70">
        {L('أرقام ونسب حاسبة التصالح والمساحة. التعديلات تظهر فورًا للزوّار. أضف المساحات القياسية الجديدة هنا عند توفّرها.', 'The figures and rates behind the reconciliation and area calculator. Edits appear to visitors immediately. Add new standard areas here as they become available.')}
      </p>
      <CalculatorSettingsClient initial={config} />
    </div>
  );
}
