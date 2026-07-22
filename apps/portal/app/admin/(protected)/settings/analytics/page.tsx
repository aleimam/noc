import { getLocale } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { AnalyticsClient } from './AnalyticsClient';

export const dynamic = 'force-dynamic';
const KEYS = [
  'ga4_newobour', 'pixel_newobour', 'ga4_alsawarey', 'pixel_alsawarey',
  'gsc_newobour', 'gsc_alsawarey', 'bing_newobour', 'bing_alsawarey', 'yandex_newobour', 'yandex_alsawarey',
];

export default async function AnalyticsSettings() {
  await requirePermission('settings', 'VIEW');
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const rows = await prisma.setting.findMany({ where: { key: { in: KEYS } } });
  const values = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{L('التحليلات والتتبّع', 'Analytics & tracking')}</h1>
        <a href="/admin/settings" className="text-sm text-accent">{L('← الإعدادات', '← Settings')}</a>
      </div>
      <p className="text-sm opacity-70">{L('معرّفات Google Analytics و Meta Pixel ورموز التحقق من محركات البحث (Google / Bing / Yandex) لكل موقع. تُحمَّل نصوص التتبّع بعد موافقة الزائر على ملفات تعريف الارتباط.', 'Google Analytics and Meta Pixel IDs plus search-engine verification tokens (Google / Bing / Yandex) for each site. Tracking scripts load only after the visitor accepts cookies.')}</p>
      <AnalyticsClient values={values} locale={locale} />
    </div>
  );
}
