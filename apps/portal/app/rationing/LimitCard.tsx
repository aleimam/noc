import { waPhone } from '@noc/config';

// Shown when a visitor exceeds the New Obour rationing quota (search or record views).
// Friendly + big for low-tech users; offers login (more budget) or a short wait.
export function LimitCard({ locale, loggedIn, whatsapp }: { locale: 'ar' | 'en'; loggedIn: boolean; whatsapp?: string | null }) {
  const ar = locale === 'ar';
  return (
    <div className="rounded-2xl border-2 border-gold/50 bg-gold-50 p-6 text-center">
      <div className="text-4xl" aria-hidden>
        ⏳
      </div>
      <p className="mt-3 text-2xl font-black text-navy-800">
        {ar ? 'لقد وصلت للحد المجاني' : 'You’ve reached the free limit'}
      </p>
      <p className="mt-2 text-lg text-ink-700">
        {loggedIn
          ? ar
            ? 'لقد أجريت عددًا كبيرًا من عمليات البحث هذه الساعة. من فضلك انتظر قليلاً ثم حاول مرة أخرى.'
            : 'You’ve done a lot this hour. Please wait a little and try again.'
          : ar
            ? 'سجّل الدخول برقم هاتفك للحصول على عدد أكبر، أو انتظر قليلاً ثم حاول مرة أخرى.'
            : 'Sign in with your phone number for more, or wait a little and try again.'}
      </p>
      {!loggedIn && (
        <a
          href="/account/login?next=/rationing"
          className="mt-4 inline-block rounded-xl bg-navy-700 px-6 py-3 text-lg font-bold text-white"
        >
          {ar ? 'تسجيل الدخول للمزيد' : 'Sign in for more'}
        </a>
      )}
      {whatsapp && (
        <div className="mt-3">
          <a href={`https://wa.me/${waPhone(whatsapp)}`} className="text-base text-navy-600 underline">
            {ar ? 'تحتاج مساعدة؟ راسلنا' : 'Need help? Message us'}
          </a>
        </div>
      )}
    </div>
  );
}
