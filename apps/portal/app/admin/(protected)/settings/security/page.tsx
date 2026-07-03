import { getLocale } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { getSecurityLevel } from '../../../../../lib/security';
import { SecurityClient } from './SecurityClient';

export const dynamic = 'force-dynamic';

export default async function SecurityPage() {
  await requirePermission('settings', 'VIEW');
  const level = await getSecurityLevel();
  const locale = await getLocale();
  const en = locale === 'en';
  const L = (ar: string, enText: string) => (en ? enText : ar);

  const options = [
    {
      value: 'LIGHT',
      title: L('خفيف', 'Light'),
      summary: L('كل شيء متاح — حدود واسعة', 'Everything open — generous limits'),
      points: [
        L('كل شيء متاح للجميع بدون تسجيل (بحث، صور كشوف، خرائط)', 'Everything public, no login (search, scans, maps)'),
        L('حتى ٣٠ عملية بحث في الساعة للزائر (٢٠٠ عند تسجيل الدخول)', 'Up to 30 searches/hour per visitor (200 when logged in)'),
        L('الأضعف ضد نسخ البيانات بالجملة', 'Weakest against bulk copying'),
      ],
    },
    {
      value: 'MEDIUM',
      title: L('متوسط (موصى به)', 'Medium (recommended)'),
      summary: L('كل شيء متاح، مع حدّ لعدد عمليات البحث', 'Everything open, with a search quota'),
      points: [
        L('كل شيء متاح بدون تسجيل — لا حاجة لتسجيل الدخول للتصفح', 'Everything public, no login needed to browse'),
        L('١٠ عمليات بحث/فتح سجل في الساعة للزائر، أكثر عند تسجيل الدخول', '10 searches/record-views per hour for visitors, more when logged in'),
        L('يمنع النسخ بالجملة دون إزعاج المستخدم العادي', 'Stops bulk copying without annoying normal users'),
      ],
    },
    {
      value: 'HIGH',
      title: L('عالٍ — للطوارئ', 'High — emergency'),
      summary: L('أقصى حماية أثناء محاولة نسخ فعلية', 'Maximum protection during an active attack'),
      points: [
        L('صور الكشوف والخرائط تتطلب تسجيل الدخول بالهاتف', 'Sheet scans and maps require phone login'),
        L('عدد عمليات بحث أقل بكثير للزائر (٥ في الساعة)', 'Much lower visitor quota (5/hour)'),
        L('استخدمه مؤقتًا عند رصد محاولة نسخ ثم أعده للمتوسط', 'Use temporarily during a scraping attempt, then revert'),
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{L('الأمان ومستوى الحماية', 'Security & protection level')}</h1>
        <a href="/admin/settings" className="text-sm text-accent">
          {L('← الإعدادات', '← Settings')}
        </a>
      </div>
      <p className="max-w-2xl text-sm opacity-70">
        {L(
          'يتحكّم هذا الإعداد في عدد عمليات البحث المسموحة للزائر في الساعة على موقع العبور الجديد (لا يؤثر على الصواري). المستوى «المتوسط» موصى به: كل شيء متاح للجميع، مع حدّ لطيف يمنع نسخ البيانات بالجملة. ارفعه إلى «عالٍ» مؤقتًا عند الاشتباه في محاولة نسخ — يسري التغيير مباشرةً بلا إعادة نشر.',
          'This setting controls how many searches a visitor may do per hour on New Obour (it does not affect Al Sawarey). "Medium" is recommended: everything stays open to everyone, with a gentle quota that blocks bulk copying. Raise it to "High" temporarily if you suspect scraping — it takes effect at once, no redeploy.',
        )}
      </p>
      <SecurityClient
        current={level}
        options={options}
        saveLabel={L('حفظ', 'Save')}
        savingLabel={L('جارٍ الحفظ…', 'Saving…')}
        savedLabel={L('تم الحفظ', 'Saved')}
      />
    </div>
  );
}
