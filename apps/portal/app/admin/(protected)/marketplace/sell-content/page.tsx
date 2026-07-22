import { getLocale } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { DEFAULT_SELL_CONTENT, type SellContent } from '@noc/config';
import { SellContentEditor } from './SellContentEditor';

export const dynamic = 'force-dynamic';

export default async function SellContentPage() {
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  await requirePermission('storefront', 'VIEW');
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
        <h1 className="text-2xl font-bold text-primary">{L('محتوى صفحة «بيع أرضك»', '“Sell your land” page content')}</h1>
        <a href="/admin/marketplace" className="text-sm text-accent">{L('← السوق', '← Marketplace')}</a>
      </div>
      <p className="text-sm opacity-70">{L('يظهر هذا المحتوى في صفحة بيع الأراضي على موقع الصواري. اتركه فارغاً لاستخدام النص الافتراضي.', 'This content appears on the sell-your-land page of the Al Sawarey site. Leave it empty to use the default text.')}</p>
      <SellContentEditor initial={initial} />
    </div>
  );
}
