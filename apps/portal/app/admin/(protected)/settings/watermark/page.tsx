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
        <h1 className="text-2xl font-bold text-primary">ختم الصور بالشعار والتذييل</h1>
        <a href="/admin/marketplace" className="text-sm text-accent">← الصواري</a>
      </div>
      <WatermarkClient initial={initial} />
    </div>
  );
}
