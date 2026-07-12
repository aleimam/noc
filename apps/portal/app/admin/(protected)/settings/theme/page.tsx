import { requirePermission } from '@noc/auth';
import { getBrandTheme } from '../../../../../lib/theme';
import { ThemeEditor } from './ThemeEditor';

export const dynamic = 'force-dynamic';

export default async function ThemePage() {
  await requirePermission('appearance', 'VIEW');
  const [newobour, alsawarey] = await Promise.all([getBrandTheme('newobour'), getBrandTheme('alsawarey')]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">المظهر والألوان / Appearance</h1>
        <a href="/admin/settings" className="text-sm text-accent">← الإعدادات</a>
      </div>
      <p className="text-sm opacity-70">
        ألوان وخطوط وشكل كل موقع — تُطبَّق فورًا بعد الحفظ. اترك الحقل فارغًا لاستخدام الافتراضي.
        <span dir="ltr"> Colors, fonts and shape per site; blank = default.</span>
      </p>
      <ThemeEditor brand="newobour" title="العبور الجديدة — newobour.com" initial={newobour} />
      <ThemeEditor brand="alsawarey" title="الصواري — alsawarey.com" initial={alsawarey} />
    </div>
  );
}
