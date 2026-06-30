'use client';

import { useState, type FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';

// Only allow same-site relative paths as a post-login destination (no open redirects).
function safeNext(raw: string | null): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw;
  return '/app';
}

export default function CustomerLoginPage() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const next = safeNext(useSearchParams().get('next'));
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMsg('');
    const res = await fetch('/api/auth/otp/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, locale }),
    });
    setLoading(false);
    if (res.ok) {
      setStep('code');
      setMsg(t('codeSent'));
    } else {
      setError(t('sendFailed'));
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await signIn('otp', { phone, code, redirect: false });
    if (res?.ok) {
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
    setLoading(false);
    setError(t('invalidCode'));
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-graphite/15 p-6">
        <h1 className="text-xl font-bold text-primary">{t('customerLogin')}</h1>

        {step === 'phone' ? (
          <form onSubmit={sendCode} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-sm">{t('phone')}</label>
              <input
                type="tel"
                inputMode="tel"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                placeholder={t('phonePlaceholder')}
                className="w-full rounded-md border border-graphite/20 bg-transparent px-3 py-2"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-primary px-3 py-2 text-soft disabled:opacity-60"
            >
              {t('sendCode')}
              {loading ? '…' : ''}
            </button>
          </form>
        ) : (
          <form onSubmit={verify} className="space-y-4">
            {msg && <p className="text-sm text-green">{msg}</p>}
            <p className="text-sm opacity-80">
              {t('codeSentTo')} <strong dir="ltr">{phone}</strong>
            </p>
            <div className="space-y-1">
              <label className="block text-sm">{t('enterCode')}</label>
              <input
                type="text"
                inputMode="numeric"
                dir="ltr"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                maxLength={6}
                className="w-full rounded-md border border-graphite/20 bg-transparent px-3 py-2 tracking-[0.4em]"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-primary px-3 py-2 text-soft disabled:opacity-60"
            >
              {t('verify')}
              {loading ? '…' : ''}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('phone');
                setCode('');
                setError('');
              }}
              className="w-full text-sm opacity-70 hover:opacity-100"
            >
              {t('resend')}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
