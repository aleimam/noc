'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { startAreaFollow, confirmAreaFollow } from './actions';

// text-base (16px) — anything smaller triggers iOS focus-zoom on the whole page.
const inp = 'w-full rounded-md border border-graphite/20 bg-transparent px-3 py-2 text-base';

export function FollowArea({ neighborhoodId }: { neighborhoodId: string }) {
  const t = useTranslations('lands');
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [step, setStep] = useState<'form' | 'code'>('form');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setInterval(() => setResendIn((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [resendIn]);

  const errText = (err: string) =>
    err === 'phone_required' || err === 'invalid_phone' ? t('phoneInvalid')
    : err === 'invalid_code' ? t('otpInvalid')
    : t('actionFailed');

  // Re-send the OTP (same phone) with a 60s cooldown.
  function resend() {
    if (resendIn > 0 || pending) return;
    setError('');
    setResendIn(60);
    start(async () => {
      const r = await startAreaFollow({ neighborhoodId, name, phone });
      if (!r.ok) setError(errText(r.error));
    });
  }

  if (done) return <p className="rounded-md bg-green/10 px-4 py-3 text-sm text-green">{t('registered')}</p>;

  return (
    <div className="rounded-lg border border-green/40 bg-green/5 p-4">
      <p className="font-medium text-primary">{t('followCta')}</p>
      {!open ? (
        <button onClick={() => setOpen(true)} className="mt-3 rounded-md bg-green px-4 py-2 text-sm font-semibold text-white">{t('followLand')}</button>
      ) : step === 'code' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!code.trim()) return;
            setError('');
            start(async () => {
              const r = await confirmAreaFollow({ neighborhoodId, name, phone, code: code.trim() });
              if (r.ok) setDone(true);
              else setError(errText(r.error));
            });
          }}
          className="mt-3 flex flex-wrap items-end gap-2"
        >
          <p className="w-full text-sm text-primary">{t('otpSent')} <strong dir="ltr">{phone}</strong></p>
          <label className="text-sm">{t('otpLabel')}<input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" dir="ltr" maxLength={6} className={`${inp} tracking-[0.3em]`} required /></label>
          <button disabled={pending} className="rounded-md bg-primary px-4 py-2 text-sm text-soft disabled:opacity-50">{pending ? t('sending') : t('otpVerify')}</button>
          <button type="button" disabled={pending || resendIn > 0} onClick={resend} className="text-sm text-graphite disabled:opacity-50">
            {resendIn > 0 ? t('otpResendWait', { s: resendIn }) : t('otpResendNow')}
          </button>
          <button type="button" onClick={() => { setStep('form'); setCode(''); setError(''); setResendIn(0); }} className="text-sm text-graphite">{t('otpResend')}</button>
          {error && <span className="w-full text-sm text-red-600">{error}</span>}
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!phone.trim()) return;
            setError('');
            start(async () => {
              const r = await startAreaFollow({ neighborhoodId, name, phone });
              if (!r.ok) { setError(errText(r.error)); return; }
              if (r.status === 'need_otp') setStep('code');
              else setDone(true);
            });
          }}
          className="mt-3 flex flex-wrap items-end gap-2"
        >
          <label className="text-sm">{t('name')}<input value={name} onChange={(e) => setName(e.target.value)} className={inp} /></label>
          <label className="text-sm">{t('phone')}<input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" className={inp} required /></label>
          <button disabled={pending} className="rounded-md bg-primary px-4 py-2 text-sm text-soft disabled:opacity-50">{pending ? t('sending') : t('send')}</button>
          {error && <span className="w-full text-sm text-red-600">{error}</span>}
        </form>
      )}
    </div>
  );
}
