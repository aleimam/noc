import { getLocale } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { BrandingClient } from './BrandingClient';

export const dynamic = 'force-dynamic';

const KEYS = [
  'brand_newobour_logo',
  'brand_newobour_logo_dark',
  'brand_newobour_favicon',
  'brand_alsawarey_logo',
  'brand_alsawarey_logo_dark',
  'brand_alsawarey_favicon',
  'brand_alsawarey_hero',
];

export default async function BrandingPage() {
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  await requirePermission('appearance', 'VIEW');
  const rows = await prisma.setting.findMany({ where: { key: { in: KEYS } } });
  const values = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{L('الشعارات والهوية', 'Logos & identity')}</h1>
        <a href="/admin/settings" className="text-sm text-accent">{L('← الإعدادات', '← Settings')}</a>
      </div>
      <p className="text-sm opacity-70">{L('ارفع شعار كل موقع وأيقونته. تظهر التغييرات بعد تحديث الصفحة. اترك الحقل فارغاً لاستخدام الشعار الافتراضي.', 'Upload each site’s logo and icon. Changes appear after a page refresh. Leave a field empty to use the default logo.')}</p>
      <BrandingClient values={values} />
    </div>
  );
}
