import { getLocale } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { mergeStorefront, DEFAULT_STOREFRONT } from '@noc/config';
import { StorefrontEditor } from './StorefrontEditor';

export const dynamic = 'force-dynamic';

export default async function StorefrontPage() {
  await requirePermission('storefront', 'VIEW');
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const row = await prisma.setting.findUnique({ where: { key: 'alsawarey.storefront' } });
  const initial = row?.value ? safeMerge(row.value) : DEFAULT_STOREFRONT;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{L('واجهة موقع الصواري', 'Al Sawarey storefront')}</h1>
        <a href="/admin/marketplace" className="text-sm text-accent">{L('← السوق', '← Marketplace')}</a>
      </div>
      <p className="text-sm opacity-70">
        {L('تحكّم في نصوص وأقسام الصفحة الرئيسية للصواري (الواجهة، الأقسام وترتيبها، الفلاتر السريعة، القائمة، رقم التواصل، والتذييل). التغييرات تظهر بعد التحديث.', 'Control the text and sections of the Al Sawarey home page (hero, sections and their order, quick filters, navigation, contact number and footer). Changes appear after a refresh.')}
      </p>
      <StorefrontEditor initial={initial} />
    </div>
  );
}

function safeMerge(value: string) {
  try {
    return mergeStorefront(JSON.parse(value));
  } catch {
    return DEFAULT_STOREFRONT;
  }
}
