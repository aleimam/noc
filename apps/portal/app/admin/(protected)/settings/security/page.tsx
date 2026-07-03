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
      summary: L('كل شيء متاح للجميع — أقل حماية', 'Everything public — least protection'),
      points: [
        L('البحث والتفاصيل والصور والخرائط متاحة بدون تسجيل', 'Search, details, scans and maps all public, no login'),
        L('حتى ٥٠ نتيجة في الصفحة', 'Up to 50 results per page'),
        L('الأضعف ضد نسخ البيانات', 'Weakest against bulk copying'),
      ],
    },
    {
      value: 'MEDIUM',
      title: L('متوسط (موصى به)', 'Medium (recommended)'),
      summary: L('البحث عام، والأصول الثمينة محمية', 'Search public, the valuable assets protected'),
      points: [
        L('البحث والتفاصيل الأساسية تبقى متاحة للجميع', 'Search + basic details stay public'),
        L('صور الكشوف والخرائط تتطلب تسجيل الدخول بالهاتف', 'Sheet scans and maps require phone login'),
        L('حتى ٥٠ نتيجة + حد للطلبات لكل زائر', 'Up to 50 results + per-visitor rate limit'),
      ],
    },
    {
      value: 'HIGH',
      title: L('عالٍ', 'High'),
      summary: L('أقصى حماية — للحوادث أو الطوارئ', 'Maximum protection — for incidents'),
      points: [
        L('صفحة التفاصيل الكاملة والصور والخرائط تتطلب تسجيل الدخول', 'Full detail page, scans and maps all require login'),
        L('تفاصيل إعلانات السوق تتطلب تسجيل الدخول', 'Marketplace listing details require login'),
        L('حتى ٢٥ نتيجة + تشديد حد الطلبات', 'Up to 25 results + tighter rate limit'),
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
          'يتحكّم هذا الإعداد في كمية البيانات المتاحة للزوّار دون تسجيل، وفي مدى صرامة حدود الطلبات. المستوى «المتوسط» موصى به. ارفعه إلى «عالٍ» فورًا عند الاشتباه في محاولة نسخ للبيانات — يسري التغيير مباشرةً بلا إعادة نشر.',
          'This setting controls how much data visitors can see without logging in, and how strict the rate limits are. "Medium" is recommended. Raise it to "High" immediately if you suspect someone is copying your data — it takes effect at once, no redeploy.',
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
