'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { isValidPhone } from '@noc/config';

// Only allow same-site relative paths as a post-login destination (no open redirects).
function safeNext(raw: string | null): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw;
  return '/account';
}

export default function CustomerLoginPage() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const tn = useTranslations('nav');
  const locale = useLocale();
  const router = useRouter();
  const next = safeNext(useSearchParams().get('next'));
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setInterval(() => setResendIn((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [resendIn]);

  async function requestCode(): Promise<boolean> {
    const res = await fetch('/api/auth/otp/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, locale }),
    });
    return res.ok;
  }

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    if (!isValidPhone(phone)) { setError(tc('phoneInvalid')); return; }
    setLoading(true);
    setError('');
    setMsg('');
    const ok = await requestCode();
    setLoading(false);
    if (ok) {
      setStep('code');
      setMsg(t('codeSent'));
      setResendIn(60);
    } else {
      setError(t('sendFailed'));
    }
  }

  // Actually re-send the SMS (same phone) — with a 60s cooldown against tapping repeatedly.
  async function resend() {
    if (loading || resendIn > 0) return;
    setLoading(true);
    setError('');
    setMsg('');
    const ok = await requestCode();
    setLoading(false);
    if (ok) {
      setMsg(t('codeSent'));
      setResendIn(60);
    } else {
      setError(t('sendFailed'));
    }
  }

  /** Turn a failed sign-in into an invalid-code or lockout-cooldown message. */
  async function failureMessage(): Promise<string> {
    try {
      const r = await fetch('/api/login-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'customer', identifier: phone }),
      }).then((res) => res.json());
      if (r?.retryAfter > 0) {
        const m = Math.ceil(r.retryAfter / 60);
        return locale === 'ar' ? `محاولات كثيرة. انتظر ${m} دقيقة ثم حاول مجددًا.` : `Too many attempts. Wait ${m} min and try again.`;
      }
    } catch { /* ignore */ }
    return t('invalidCode');
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // Auth.js v5 may resolve with { ok:false } OR throw on a bad code — handle both.
      const res = await signIn('otp', { phone, code, redirect: false });
      if (res?.ok && !res.error) {
        // Hydrate saved preferences from the account (cross-device).
        try {
          const p = await fetch('/api/preferences').then((r) => r.json());
          if (p?.locale) {
            document.cookie = `NEXT_LOCALE=${String(p.locale).toLowerCase()};path=/;max-age=31536000;samesite=lax`;
          }
          if (p?.appearance && p.appearance !== 'SYSTEM') {
            const th = String(p.appearance).toLowerCase();
            document.cookie = `NOC_THEME=${th};path=/;max-age=31536000;samesite=lax`;
            document.documentElement.classList.toggle('dark', th === 'dark');
          }
        } catch {
          /* ignore */
        }
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
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-graphite/15 p-6">
        {/* Brand header → escape hatch back to the homepage. */}
        <a href="/" className="flex items-center justify-center gap-2.5 pb-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo" alt="" className="h-10 w-auto" />
          <span className="text-xl font-extrabold text-primary">{tn('brand')}</span>
        </a>
        <h1 className="text-xl font-bold text-primary">{t('customerLogin')}</h1>

        {step === 'phone' ? (
          <form onSubmit={sendCode} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-base">{t('phone')}</label>
              <input
                type="tel"
                inputMode="tel"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                placeholder={t('phonePlaceholder')}
                className="w-full rounded-md border border-graphite/20 bg-transparent px-3 py-3 text-lg"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-primary px-3 py-3 text-lg text-soft disabled:opacity-60"
            >
              {t('sendCode')}
              {loading ? '…' : ''}
            </button>
          </form>
        ) : (
          <form onSubmit={verify} className="space-y-4">
            {msg && <p className="text-sm text-green">{msg}</p>}
            <p className="text-base opacity-80">
              {t('codeSentTo')} <strong dir="ltr">{phone}</strong>
            </p>
            <div className="space-y-1">
              <label className="block text-base">{t('enterCode')}</label>
              <input
                type="text"
                inputMode="numeric"
                dir="ltr"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                maxLength={6}
                className="w-full rounded-md border border-graphite/20 bg-transparent px-3 py-3 text-lg tracking-[0.4em]"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-primary px-3 py-3 text-lg text-soft disabled:opacity-60"
            >
              {t('verify')}
              {loading ? '…' : ''}
            </button>
            <button
              type="button"
              onClick={resend}
              disabled={loading || resendIn > 0}
              className="w-full text-base opacity-70 hover:opacity-100 disabled:opacity-40"
            >
              {resendIn > 0 ? t('resendWait', { s: resendIn }) : t('resend')}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('phone');
                setCode('');
                setError('');
                setMsg('');
                setResendIn(0);
              }}
              className="w-full text-base opacity-70 hover:opacity-100"
            >
              {t('changeNumber')}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
