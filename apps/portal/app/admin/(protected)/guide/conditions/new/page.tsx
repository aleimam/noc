import { getLocale } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { ConditionEditor } from '../ConditionEditor';

export default async function NewBuildingCondition() {
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  await requirePermission('content', 'CREATE');
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{L('اشتراطات البناء: صفحة جديدة', 'Building requirements: new page')}</h1>
        <a href="/admin/guide/conditions" className="text-sm text-accent">{L('← رجوع', '← Back')}</a>
      </div>
      <ConditionEditor initial={{ slug: '', unitLabelAr: '', unitLabelEn: '', titleAr: '', titleEn: '', bodyAr: '', bodyEn: '', images: [], order: 0, published: true }} />
    </div>
  );
}
