import { getLocale } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { getModuleVisibility, MODULE_LABELS } from '../../../../../lib/modules';
import { ModulesClient } from './ModulesClient';

export const dynamic = 'force-dynamic';

export default async function ModulesPage() {
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  await requirePermission('settings', 'VIEW');
  const visibility = await getModuleVisibility();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{L('الخدمات الظاهرة (العبور الجديدة)', 'Visible services (New Obour)')}</h1>
        <a href="/admin/settings" className="text-sm text-accent">{L('← الإعدادات', '← Settings')}</a>
      </div>
      <p className="text-sm opacity-70">{L('تحكّم في الخدمات الظاهرة للزوّار على موقع العبور الجديدة. الخدمات المُلغاة تختفي من القائمة وتُمنع صفحاتها. (موقع الصواري ثابت.)', 'Control which services visitors see on the New Obour site. Disabled services disappear from the menu and their pages are blocked. (The Al Sawarey site is fixed.)')}</p>
      <ModulesClient initial={visibility} labels={MODULE_LABELS} />
    </div>
  );
}
