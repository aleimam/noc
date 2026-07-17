import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import {
  DEFAULT_COPYRIGHT_NEWOBOUR, DEFAULT_COPYRIGHT_NEWOBOUR_EN,
  DEFAULT_COPYRIGHT_ALSAWAREY, DEFAULT_COPYRIGHT_ALSAWAREY_EN,
  DEFAULT_SLOGAN_NEWOBOUR, DEFAULT_SLOGAN_NEWOBOUR_EN,
} from '../../../../../lib/site';
import { SiteSettingsClient } from './SiteSettingsClient';

export const dynamic = 'force-dynamic';

const KEYS = ['site.mobileMenu', 'site.slogan', 'site.slogan_en', 'copyright_newobour', 'copyright_newobour_en', 'copyright_alsawarey', 'copyright_alsawarey_en', 'site.whatsappHelp', 'whatsapp_float_newobour', 'whatsapp_float_msg_newobour', 'whatsapp_float_alsawarey', 'whatsapp_float_msg_alsawarey', 'gallery.photoAnalytics'];

export default async function SiteSettingsPage() {
  await requirePermission('settings', 'VIEW');
  const rows = await prisma.setting.findMany({ where: { key: { in: KEYS } } });
  const v = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  const initial = {
    mobileMenu: v['site.mobileMenu'] === 'compact' ? 'compact' : 'full',
    sloganNewobour: v['site.slogan'] ?? DEFAULT_SLOGAN_NEWOBOUR,
    sloganNewobourEn: v['site.slogan_en'] ?? DEFAULT_SLOGAN_NEWOBOUR_EN,
    copyrightNewobour: v['copyright_newobour'] ?? DEFAULT_COPYRIGHT_NEWOBOUR,
    copyrightNewobourEn: v['copyright_newobour_en'] ?? DEFAULT_COPYRIGHT_NEWOBOUR_EN,
    copyrightAlsawarey: v['copyright_alsawarey'] ?? DEFAULT_COPYRIGHT_ALSAWAREY,
    copyrightAlsawareyEn: v['copyright_alsawarey_en'] ?? DEFAULT_COPYRIGHT_ALSAWAREY_EN,
    whatsappHelp: v['site.whatsappHelp'] ?? '',
    whatsappFloatNewobour: v['whatsapp_float_newobour'] === '1',
    whatsappFloatMsgNewobour: v['whatsapp_float_msg_newobour'] ?? '',
    whatsappFloatAlsawarey: v['whatsapp_float_alsawarey'] === '1',
    whatsappFloatMsgAlsawarey: v['whatsapp_float_msg_alsawarey'] ?? '',
    // Photo analytics — default ON (any value except '0').
    galleryPhotoAnalytics: v['gallery.photoAnalytics'] !== '0',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">إعدادات الموقع العامة</h1>
        <a href="/admin/settings" className="text-sm text-accent">← الإعدادات</a>
      </div>
      <p className="text-sm opacity-70">قائمة الجوال، حقوق النشر (للموقعين)، رقم واتساب للمساعدة، وزر واتساب العائم لكل موقع.</p>
      <SiteSettingsClient initial={initial} />
    </div>
  );
}
