import { requirePermission } from '@noc/auth';
import { getCalculatorConfig } from '../../../../../lib/calculator/config';
import { CalculatorSettingsClient } from './CalculatorSettingsClient';

export const dynamic = 'force-dynamic';

export default async function CalculatorSettingsPage() {
  await requirePermission('settings', 'VIEW');
  const config = await getCalculatorConfig();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">حاسبة التصالح</h1>
        <a href="/admin/settings" className="text-sm text-accent">← الإعدادات</a>
      </div>
      <p className="text-sm opacity-70">
        أرقام ونسب حاسبة التصالح والمساحة. التعديلات تظهر فورًا للزوّار. أضف المساحات القياسية الجديدة هنا عند توفّرها.
      </p>
      <CalculatorSettingsClient initial={config} />
    </div>
  );
}
