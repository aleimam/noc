'use client';

import { useState, type FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';

const inp = 'w-full rounded-md border border-graphite/20 bg-transparent px-3 py-3 text-base';

/** Partner-portal login: identifier (username / email / phone) + password, or an
 *  SMS code sent to the account's phone. Big and simple — partners are phone-first. */
export default function PartnerLoginPage() {
  const locale = useLocale() as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'start' | 'code'>('start');
  const [sentTo, setSentTo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function finishLogin(fields: { password?: string; code?: string }) {
    const r = await signIn('partner', { identifier, ...fields, redirect: false });
    setLoading(false);
    if (r?.ok) router.push('/partner');
    else setError(L('بيانات الدخول غير صحيحة', 'Invalid login details'));
  }

  async function loginWithPassword(e: FormEvent) {
    e.preventDefault();
    if (!identifier.trim() || !password) return;
    setError('');
    setLoading(true);
    await finishLogin({ password });
  }

  async function sendCode() {
    if (!identifier.trim()) {
      setError(L('أدخل اسم المستخدم أو البريد أو الهاتف أولاً', 'Enter your username, email or phone first'));
      return;
    }
    setError('');
    setLoading(true);
    const res = await fetch('/api/partner/otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier }),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; sentTo?: string };
    setLoading(false);
    if (json.ok) {
      setSentTo(json.sentTo ?? '');
      setStep('code');
    } else if (json.error === 'no_phone') {
      setError(L('هذا الحساب بلا هاتف — استخدم كلمة المرور', 'No phone on this account — use your password'));
    } else if (json.error === 'not_found') {
      setError(L('لم نجد هذا الحساب — تحقق من البيانات', 'Account not found — check the details'));
    } else {
      setError(L('تعذّر إرسال الرمز، حاول بعد قليل', 'Could not send the code, try again shortly'));
    }
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setError('');
    setLoading(true);
    await finishLogin({ code });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-soft p-6">
      <div className="w-full max-w-md space-y-5 rounded-lg border border-ink-200 bg-white p-6 shadow-md">
        <div>
          <h1 className="text-2xl font-black text-navy-800">🔑 {L('بوابة الشركاء', 'Partner portal')}</h1>
          <p className="mt-1 text-sm text-ink-500">{L('إدارة إعلاناتك وأسعارك ومتابعة أدائها', 'Manage your listings, prices and performance')}</p>
        </div>

        {step === 'start' ? (
          <form onSubmit={loginWithPassword} className="space-y-4">
            <label className="block text-sm font-semibold">
              {L('اسم المستخدم أو البريد أو الهاتف', 'Username, email or phone')}
              <input dir="ltr" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required className={`${inp} mt-1`} />
            </label>
            <label className="block text-sm font-semibold">
              {L('كلمة المرور', 'Password')}
              <input dir="ltr" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={`${inp} mt-1`} />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={loading || !password} className="w-full rounded-lg bg-primary px-4 py-3 text-base font-bold text-soft disabled:opacity-50">
              {L('دخول', 'Sign in')}
            </button>
            <div className="flex items-center gap-3 text-xs text-ink-400">
              <span className="h-px flex-1 bg-ink-200" />
              {L('أو', 'or')}
              <span className="h-px flex-1 bg-ink-200" />
            </div>
            <button type="button" onClick={sendCode} disabled={loading} className="w-full rounded-lg border border-gold-300/70 bg-gold/10 px-4 py-3 text-base font-bold text-navy-800 disabled:opacity-50">
              📲 {L('أرسل رمز دخول إلى هاتفي', 'Send a login code to my phone')}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="space-y-4">
            <p className="text-sm text-ink-600">
              {L('أرسلنا رمز التحقق إلى', 'We sent a code to')} <strong dir="ltr">{sentTo}</strong>
            </p>
            <input
              dir="ltr"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              className={`${inp} text-center text-2xl tracking-[0.5em]`}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={loading} className="w-full rounded-lg bg-primary px-4 py-3 text-base font-bold text-soft disabled:opacity-50">
              {L('تأكيد الدخول', 'Verify & sign in')}
            </button>
            <button type="button" onClick={() => { setStep('start'); setCode(''); setError(''); }} className="w-full text-sm text-ink-500 hover:text-ink-700">
              {L('رجوع', 'Back')}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
