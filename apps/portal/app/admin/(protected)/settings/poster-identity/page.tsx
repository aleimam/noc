import { getLocale } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { DEFAULT_POSTER_THEME } from '../../../../../lib/poster/render';
import { PosterIdentityForm } from './PosterIdentityForm';
import type { PosterThemeInput } from './actions';

export const dynamic = 'force-dynamic';

export default async function PosterIdentityPage() {
  await requirePermission('settings', 'VIEW');
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  const rows = await prisma.setting.findMany({
    where: { key: { in: ['posterTheme.newobour', 'posterTheme.alsawarey', 'brand_newobour_logo', 'brand_alsawarey_logo'] } },
  });
  const m = Object.fromEntries(rows.map((s) => [s.key, s.value]));
  const load = (key: string): PosterThemeInput => {
    let saved: Partial<PosterThemeInput> = {};
    try { saved = JSON.parse(m[key] ?? '') as Partial<PosterThemeInput>; } catch { /* unset */ }
    return {
      navy: saved.navy ?? DEFAULT_POSTER_THEME.navy,
      gold: saved.gold ?? DEFAULT_POSTER_THEME.gold,
      cream: saved.cream ?? DEFAULT_POSTER_THEME.cream,
      tint: saved.tint ?? DEFAULT_POSTER_THEME.tint,
      ink: saved.ink ?? DEFAULT_POSTER_THEME.ink,
      font: saved.font ?? DEFAULT_POSTER_THEME.font,
      logoPath: saved.logoPath ?? '',
      headerLogo: saved.headerLogo ?? '',
      phone: saved.phone ?? '',
      domain: saved.domain ?? '',
    };
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">{L('هوية الصور المولّدة', 'Generated-image identity')}</h1>
        <p className="mt-1 text-sm opacity-70">
          {L(
            'ألوان وخط وشعار البوستر والبطاقات لكل علامة — منفصلة عن هوية المواقع. بعد الحفظ استخدم «إعادة التوليد» لتطبيقها على الإعلانات.',
            'Colors, font and logo of the poster and cards per brand — separate from the websites. After saving, use Regenerate to apply to listings.',
          )}
        </p>
      </div>
      <PosterIdentityForm brand="newobour" brandLabel={L('العبور الجديد', 'New Obour')} initial={load('posterTheme.newobour')} defaultLogo={m['brand_newobour_logo'] ?? null} locale={locale} />
      <PosterIdentityForm brand="alsawarey" brandLabel={L('الصواري', 'Al Sawarey')} initial={load('posterTheme.alsawarey')} defaultLogo={m['brand_alsawarey_logo'] ?? null} locale={locale} />
    </div>
  );
}
