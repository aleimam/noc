'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { isValidPhone } from '@noc/config';

function safeNext(raw: string | null): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw;
  return '/account';
}

const RESEND_SECONDS = 60;

export default function CustomerLogin() {
  const locale = useLocale();
  const ar = locale === 'ar';
  const L = (a: string, e: string) => (ar ? a : e);
  const router = useRouter();
  const next = safeNext(useSearchParams().get('next'));
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0); // seconds until "resend" unlocks

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  /** Request an OTP; used by the phone step and the resend button on the code step. */
  async function requestCode(): Promise<void> {
    setLoading(true);
    setError('');
    // try/catch/finally — a dropped request on a weak connection used to escape before
    // setLoading(false), leaving the button spinning forever with no message and no way back
    // except a reload that loses the typed number.
    try {
      const res = await fetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, locale }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok) {
        setStep('code');
        setCooldown(RESEND_SECONDS);
        return;
      }
      if (j?.error === 'rate_limited' || j?.error === 'cooldown') {
        setError(L('حاولت كثيرًا — انتظر دقائق ثم أعد المحاولة', 'Too many attempts — wait a few minutes then try again'));
      } else {
        setError(L('تعذّر إرسال الرمز، تأكد من الرقم', 'Could not send the code — check the number'));
      }
    } catch {
      setError(L('تعذّر الاتصال — تحقق من الإنترنت وحاول مرة أخرى', 'Connection failed — check your internet and try again'));
    } finally {
      setLoading(false);
    }
  }

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    if (!isValidPhone(phone)) {
      setError(L('أدخل رقم موبايل صحيح: 11 رقمًا يبدأ بـ 01، أو رقمًا دوليًا يبدأ بعلامة +', 'Enter a valid phone: 11 digits starting with 01, or an international number starting with +'));
      return;
    }
    await requestCode();
  }

  /** Turn a failed sign-in into an invalid-code or lockout-cooldown message (mirrors the portal). */
  async function failureMessage(): Promise<string> {
    try {
      const r = await fetch('/api/login-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'customer', identifier: phone }),
      }).then((res) => res.json());
      if (r?.retryAfter > 0) {
        const m = Math.ceil(r.retryAfter / 60);
        return L(`محاولات كثيرة. انتظر ${m} دقيقة ثم حاول مجددًا.`, `Too many attempts. Wait ${m} min and try again.`);
      }
    } catch { /* ignore */ }
    return L('رمز غير صحيح', 'Invalid code');
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // Auth.js v5 may resolve with { ok:false } OR throw on a bad code — handle both.
      const res = await signIn('otp', { phone, code, redirect: false });
      if (res?.ok && !res.error) {
        router.push(next);
        return;
      }
      setError(await failureMessage());
    } catch {
      setError(await failureMessage());
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-soft p-6">
      <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 text-navy-800 shadow-md">
        <a href="/" className="block text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo" alt="الصواري" className="mx-auto h-12 w-auto" />
        </a>
        <h1 className="text-center text-xl font-bold text-navy-800">{L('تسجيل الدخول', 'Sign in')}</h1>

        {step === 'phone' ? (
          <form onSubmit={sendCode} className="space-y-3">
            <label className="block text-sm">{L('رقم الهاتف', 'Phone')}
              <input type="tel" inputMode="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="01XXXXXXXXX" className="mt-1 w-full rounded-xl border border-ink-200 px-3 py-2.5" />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button disabled={loading} className="w-full rounded-xl bg-navy px-3 py-2.5 font-bold text-soft disabled:opacity-60">{L('إرسال الرمز', 'Send code')}{loading ? '…' : ''}</button>
          </form>
        ) : (
          <form onSubmit={verify} className="space-y-3">
            <p className="text-sm text-ink-600">{L('أدخل الرمز المرسل إلى', 'Enter the code sent to')} <strong dir="ltr">{phone}</strong></p>
            <input type="text" inputMode="numeric" dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} required maxLength={6} className="w-full rounded-xl border border-ink-200 px-3 py-2.5 tracking-[0.4em]" />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button disabled={loading} className="w-full rounded-xl bg-gold px-3 py-2.5 font-bold text-navy-900 disabled:opacity-60">{L('دخول', 'Verify')}{loading ? '…' : ''}</button>
            <button
              type="button"
              onClick={() => { if (cooldown <= 0 && !loading) void requestCode(); }}
              disabled={cooldown > 0 || loading}
              className="w-full rounded-xl border border-ink-200 px-3 py-2.5 text-sm font-semibold text-navy-700 disabled:opacity-60"
            >
              {cooldown > 0
                ? L(`إعادة الإرسال بعد ${cooldown} ثانية`, `Resend in ${cooldown}s`)
                : L('إعادة إرسال الرمز', 'Resend code')}
            </button>
            <button type="button" onClick={() => { setStep('phone'); setCode(''); setError(''); }} className="w-full text-sm text-ink-500">{L('تغيير الرقم', 'Change number')}</button>
          </form>
        )}
      </div>
    </main>
  );
}
