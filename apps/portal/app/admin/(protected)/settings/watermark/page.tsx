import { requirePermission } from '@noc/auth';
import { getStampSettings } from '../../../../../lib/stamp';
import { WatermarkClient } from './WatermarkClient';

export const dynamic = 'force-dynamic';

export default async function StampPage() {
  await requirePermission('marketplace', 'VIEW');
  const initial = await getStampSettings();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">ختم الصور (على مستوى النظام)</h1>
        <a href="/admin" className="text-sm text-accent">← لوحة التحكم</a>
      </div>
      <WatermarkClient initial={initial} />
    </div>
  );
}
