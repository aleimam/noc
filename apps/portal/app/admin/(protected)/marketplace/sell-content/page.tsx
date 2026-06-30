import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { DEFAULT_SELL_CONTENT, type SellContent } from '@noc/config';
import { SellContentEditor } from './SellContentEditor';

export const dynamic = 'force-dynamic';

export default async function SellContentPage() {
  await requirePermission('marketplace', 'VIEW');
  const row = await prisma.setting.findUnique({ where: { key: 'alsawarey.sell' } });
  let initial: SellContent = DEFAULT_SELL_CONTENT;
  if (row?.value) {
    try {
      initial = { ...DEFAULT_SELL_CONTENT, ...(JSON.parse(row.value) as Partial<SellContent>) };
    } catch {
      /* keep defaults */
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">محتوى صفحة «بيع أرضك»</h1>
        <a href="/admin/marketplace" className="text-sm text-accent">← السوق</a>
      </div>
      <p className="text-sm opacity-70">يظهر هذا المحتوى في صفحة بيع الأراضي على موقع الصواري. اتركه فارغاً لاستخدام النص الافتراضي.</p>
      <SellContentEditor initial={initial} />
    </div>
  );
}
