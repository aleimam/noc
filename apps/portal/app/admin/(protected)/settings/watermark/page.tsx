import { requirePermission } from '@noc/auth';
import { getWatermarkConfig } from '../../../../../lib/watermark';
import { WatermarkClient } from './WatermarkClient';

export const dynamic = 'force-dynamic';

export default async function WatermarkPage() {
  await requirePermission('marketplace', 'VIEW');
  const initial = await getWatermarkConfig();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">العلامة المائية للأراضي (الصواري)</h1>
        <a href="/admin/marketplace" className="text-sm text-accent">← الصواري</a>
      </div>
      <WatermarkClient initial={initial} />
    </div>
  );
}
