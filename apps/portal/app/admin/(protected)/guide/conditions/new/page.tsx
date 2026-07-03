import { requirePermission } from '@noc/auth';
import { ConditionEditor } from '../ConditionEditor';

export default async function NewBuildingCondition() {
  await requirePermission('guide', 'CREATE');
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">اشتراطات البناء: صفحة جديدة</h1>
        <a href="/admin/guide/conditions" className="text-sm text-accent">← رجوع</a>
      </div>
      <ConditionEditor initial={{ slug: '', unitLabelAr: '', unitLabelEn: '', titleAr: '', titleEn: '', bodyAr: '', bodyEn: '', order: 0, published: true }} />
    </div>
  );
}
