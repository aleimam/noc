import { requirePermission } from '@noc/auth';
import { getModuleVisibility, MODULE_LABELS } from '../../../../../lib/modules';
import { ModulesClient } from './ModulesClient';

export const dynamic = 'force-dynamic';

export default async function ModulesPage() {
  await requirePermission('settings', 'VIEW');
  const visibility = await getModuleVisibility();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">الخدمات الظاهرة (العبور الجديد)</h1>
        <a href="/admin/settings" className="text-sm text-accent">← الإعدادات</a>
      </div>
      <p className="text-sm opacity-70">تحكّم في الخدمات الظاهرة للزوّار على موقع العبور الجديد. الخدمات المُلغاة تختفي من القائمة وتُمنع صفحاتها. (موقع الصواري ثابت.)</p>
      <ModulesClient initial={visibility} labels={MODULE_LABELS} />
    </div>
  );
}
