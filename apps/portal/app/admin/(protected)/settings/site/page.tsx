import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { DEFAULT_COPYRIGHT_NEWOBOUR, DEFAULT_COPYRIGHT_ALSAWAREY, DEFAULT_SLOGAN_NEWOBOUR } from '../../../../../lib/site';
import { SiteSettingsClient } from './SiteSettingsClient';

export const dynamic = 'force-dynamic';

const KEYS = ['site.mobileMenu', 'site.slogan', 'copyright_newobour', 'copyright_alsawarey', 'site.whatsappHelp'];

export default async function SiteSettingsPage() {
  await requirePermission('settings', 'VIEW');
  const rows = await prisma.setting.findMany({ where: { key: { in: KEYS } } });
  const v = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  const initial = {
    mobileMenu: v['site.mobileMenu'] === 'compact' ? 'compact' : 'full',
    sloganNewobour: v['site.slogan'] ?? DEFAULT_SLOGAN_NEWOBOUR,
    copyrightNewobour: v['copyright_newobour'] ?? DEFAULT_COPYRIGHT_NEWOBOUR,
    copyrightAlsawarey: v['copyright_alsawarey'] ?? DEFAULT_COPYRIGHT_ALSAWAREY,
    whatsappHelp: v['site.whatsappHelp'] ?? '',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">إعدادات الموقع العامة</h1>
        <a href="/admin/settings" className="text-sm text-accent">← الإعدادات</a>
      </div>
      <p className="text-sm opacity-70">قائمة الجوال، حقوق النشر (للموقعين)، ورقم واتساب للمساعدة الظاهر في صفحات التقنين.</p>
      <SiteSettingsClient initial={initial} />
    </div>
  );
}
