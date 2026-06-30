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
];

export default async function BrandingPage() {
  await requirePermission('settings', 'VIEW');
  const rows = await prisma.setting.findMany({ where: { key: { in: KEYS } } });
  const values = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">الشعارات والهوية</h1>
        <a href="/admin/settings" className="text-sm text-accent">← الإعدادات</a>
      </div>
      <p className="text-sm opacity-70">ارفع شعار كل موقع وأيقونته. تظهر التغييرات بعد تحديث الصفحة. اترك الحقل فارغاً لاستخدام الشعار الافتراضي.</p>
      <BrandingClient values={values} />
    </div>
  );
}
