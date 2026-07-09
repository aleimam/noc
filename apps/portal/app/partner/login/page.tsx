'use client';

import { useState, type FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { isValidPhone } from '@noc/config';

const inp = 'w-full rounded-md border border-graphite/20 bg-transparent px-3 py-3 text-base';
const looksNumeric = (s: string) => /^[+\d][\d\s]*$/.test(s.trim());

/** Partner-portal login. Two tabs — an SMS/email code (default) or a password — sharing one
 *  identifier (username / email / phone). Errors always surface (incl. a lockout cooldown). */
export default function PartnerLoginPage() {
  const locale = useLocale() as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const router = useRouter();
  const [method, setMethod] = useState<'otp' | 'password'>('otp');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'idle' | 'sent'>('idle');
  const [sentTo, setSentTo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  /** After a failed attempt, turn a server-side lockout into a friendly cooldown message. */
  async function failureMessage(): Promise<string> {
    try {
      const r = await fetch('/api/login-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'partner', identifier }),
      }).then((res) => res.json());
      if (r?.retryAfter > 0) {
        const m = Math.ceil(r.retryAfter / 60);
        return L(`محاولات كثيرة. انتظر ${m} دقيقة ثم حاول مجددًا.`, `Too many attempts. Wait ${m} min and try again.`);
      }
    } catch { /* ignore */ }
    return L('بيانات الدخول غير صحيحة', 'Invalid login details');
  }

  async function finishLogin(fields: { password?: string; code?: string }) {
    try {
      const r = await signIn('partner', { identifier, ...fields, redirect: false });
      if (r?.ok && !r.error) {
        router.push('/partner');
        router.refresh();
        return;
      }
      setError(await failureMessage());
    } catch {
      setError(await failureMessage());
    } finally {
      setLoading(false);
    }
  }

  async function loginWithPassword(e: FormEvent) {
    e.preventDefault();
    if (!identifier.trim() || !password) return;
    setError('');
    setLoading(true);
    await finishLogin({ password });
  }

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    if (!identifier.trim()) { setError(L('أدخل اسم المستخدم أو البريد أو الهاتف أولاً', 'Enter your username, email or phone first')); return; }
    // If they typed a phone number, enforce the 11-digit 01… format.
    if (looksNumeric(identifier) && !isValidPhone(identifier)) {
      setError(L('رقم الهاتف يجب أن يكون 11 رقمًا يبدأ بـ 01', 'Phone must be 11 digits starting with 01'));
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
    if (json.ok) { setSentTo(json.sentTo ?? ''); setStep('sent'); }
    else if (json.error === 'no_phone') setError(L('هذا الحساب بلا هاتف — استخدم كلمة المرور', 'No phone on this account — use your password'));
    else if (json.error === 'not_found') setError(L('لم نجد هذا الحساب — تحقق من البيانات', 'Account not found — check the details'));
    else setError(L('تعذّر إرسال الرمز، حاول بعد قليل', 'Could not send the code, try again shortly'));
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setError('');
    setLoading(true);
    await finishLogin({ code });
  }

  const tab = (m: 'otp' | 'password', label: string) => (
    <button
      type="button"
      onClick={() => { setMethod(m); setError(''); }}
      className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-bold transition ${method === m ? 'bg-primary text-soft' : 'bg-graphite/5 text-navy-700 hover:bg-graphite/10'}`}
    >
      {label}
    </button>
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-soft p-6">
      <div className="w-full max-w-md space-y-5 rounded-lg border border-ink-200 bg-white p-6 shadow-md">
        <div>
          <h1 className="text-2xl font-black text-navy-800">🔑 {L('بوابة الشركاء', 'Partner portal')}</h1>
          <p className="mt-1 text-sm text-ink-500">{L('إدارة إعلاناتك وأسعارك ومتابعة أدائها', 'Manage your listings, prices and performance')}</p>
        </div>

        {/* Method tabs — code (default) or password. */}
        <div className="flex gap-2">
          {tab('otp', L('📲 رمز الدخول', '📲 Login code'))}
          {tab('password', L('🔒 كلمة المرور', '🔒 Password'))}
        </div>

        <label className="block text-sm font-semibold">
          {L('اسم المستخدم أو البريد أو الهاتف', 'Username, email or phone')}
          <input dir="ltr" value={identifier} onChange={(e) => { setIdentifier(e.target.value); if (step === 'sent') setStep('idle'); }} className={`${inp} mt-1`} />
        </label>

        {method === 'password' ? (
          <form onSubmit={loginWithPassword} className="space-y-4">
            <label className="block text-sm font-semibold">
              {L('كلمة المرور', 'Password')}
              <input dir="ltr" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={`${inp} mt-1`} />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={loading || !password} className="w-full rounded-lg bg-primary px-4 py-3 text-base font-bold text-soft disabled:opacity-50">
              {L('دخول', 'Sign in')}
            </button>
          </form>
        ) : step === 'idle' ? (
          <form onSubmit={sendCode} className="space-y-4">
            <p className="text-xs text-ink-500">{L('نرسل رمزًا إلى هاتف الحساب (أو بريده).', "We'll send a code to the account's phone (or email).")}</p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={loading} className="w-full rounded-lg bg-primary px-4 py-3 text-base font-bold text-soft disabled:opacity-50">
              {L('أرسل رمز الدخول', 'Send login code')}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="space-y-4">
            <p className="text-sm text-ink-600">{L('أرسلنا رمز التحقق إلى', 'We sent a code to')} <strong dir="ltr">{sentTo}</strong></p>
            <input dir="ltr" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} required className={`${inp} text-center text-2xl tracking-[0.5em]`} />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={loading} className="w-full rounded-lg bg-primary px-4 py-3 text-base font-bold text-soft disabled:opacity-50">
              {L('تأكيد الدخول', 'Verify & sign in')}
            </button>
            <button type="button" onClick={() => { setStep('idle'); setCode(''); setError(''); }} className="w-full text-sm text-ink-500 hover:text-ink-700">
              {L('رجوع', 'Back')}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
