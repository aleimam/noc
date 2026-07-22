import { getLocale } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { getBrandTheme } from '../../../../../lib/theme';
import { ThemeEditor } from './ThemeEditor';

export const dynamic = 'force-dynamic';

export default async function ThemePage() {
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  await requirePermission('appearance', 'VIEW');
  const [newobour, alsawarey] = await Promise.all([getBrandTheme('newobour'), getBrandTheme('alsawarey')]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{L('المظهر والألوان', 'Appearance')}</h1>
        <a href="/admin/settings" className="text-sm text-accent">{L('← الإعدادات', '← Settings')}</a>
      </div>
      <p className="text-sm opacity-70">
        {L('ألوان وخطوط وشكل كل موقع — تُطبَّق فورًا بعد الحفظ. اترك الحقل فارغًا لاستخدام الافتراضي.', 'Colours, fonts and shape for each site — applied immediately after saving. Leave a field empty to use the default.')}
        <span dir="ltr"> Colors, fonts and shape per site; blank = default.</span>
      </p>
      <ThemeEditor brand="newobour" title={L('العبور الجديدة — newobour.com', 'New Obour — newobour.com')} initial={newobour} />
      <ThemeEditor brand="alsawarey" title={L('الصواري — alsawarey.com', 'Al Sawarey — alsawarey.com')} initial={alsawarey} />
    </div>
  );
}
