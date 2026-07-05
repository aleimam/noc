'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { isValidPhone } from '@noc/config';
import { startFollow, confirmFollow } from './actions';

type City = { id: string; name: string };
type Fields = { applicantName: string; plotNo: string; blockNo: string; originalOwner: string; cityId: string };

const inp = 'w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-base';

export function FollowForm({
  kind,
  cities,
  defaults,
  sheetId,
  loggedIn = false,
}: {
  kind: 'FOUND' | 'WATCH';
  cities: City[];
  defaults: Partial<Fields>;
  sheetId?: string;
  loggedIn?: boolean;
}) {
  const t = useTranslations('rationing');
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [step, setStep] = useState<'form' | 'code'>('form');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [f, setF] = useState<Fields>({
    applicantName: defaults.applicantName ?? '',
    plotNo: defaults.plotNo ?? '',
    blockNo: defaults.blockNo ?? '',
    originalOwner: defaults.originalOwner ?? '',
    cityId: defaults.cityId ?? '',
  });
  const upd = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  const payload = { kind, sheetId, ...f };

  function errText(err: string): string {
    if (err === 'phone_required') return t('phoneRequired');
    if (err === 'invalid_phone') return t('phoneInvalid');
    if (err === 'invalid_code') return t('otpInvalid');
    return t('registerError');
  }

  if (done) {
    return (
      <div className="rounded-2xl border-2 border-green bg-white p-6 text-center">
        <div className="text-xl font-extrabold text-success">{t('followDoneTitle')}</div>
        <p className="mt-2 text-ink-600">{kind === 'WATCH' ? t('followDoneWatch') : t('followDoneFound')}</p>
        <Link href="/rationing" className="mt-4 inline-block rounded-xl bg-navy px-5 py-2.5 font-bold text-soft">{t('backToSearch')}</Link>
      </div>
    );
  }

  // Step 2 — the phone already has an account, so confirm ownership with the SMS code.
  if (step === 'code') {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!code.trim()) return;
          setError('');
          start(async () => {
            const r = await confirmFollow({ ...payload, phone, code: code.trim() });
            if (r.ok) setDone(true);
            else setError(errText(r.error));
          });
        }}
        className="grid gap-3.5"
      >
        <p className="text-base text-ink-700">{t('otpSent')} <strong dir="ltr">{phone}</strong></p>
        <label className="text-sm">{t('otpLabel')}
          <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" dir="ltr" maxLength={6} className={`${inp} tracking-[0.4em]`} required />
        </label>
        <div className="flex items-center gap-3">
          <button disabled={pending} className="rounded-xl bg-gold px-6 py-2.5 font-bold text-navy-900 disabled:opacity-50">
            {pending ? t('submitting') : t('otpVerify')}
          </button>
          <button type="button" onClick={() => { setStep('form'); setCode(''); setError(''); }} className="text-sm text-navy-600">
            {t('otpResend')}
          </button>
        </div>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </form>
    );
  }

  // Step 1 — follow details (+ phone for visitors).
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!f.applicantName.trim()) return;
        if (!loggedIn && !phone.trim()) { setError(t('phoneRequired')); return; }
        if (!loggedIn && !isValidPhone(phone)) { setError(t('phoneInvalid')); return; }
        setError('');
        start(async () => {
          const r = await startFollow({ ...payload, phone: loggedIn ? undefined : phone.trim() });
          if (!r.ok) { setError(errText(r.error)); return; }
          if (r.status === 'need_otp') setStep('code');
          else setDone(true);
        });
      }}
      className="grid gap-3.5 sm:grid-cols-2"
    >
      <label className="text-sm sm:col-span-2">{t('colApplicant')}<input value={f.applicantName} onChange={upd('applicantName')} className={inp} required /></label>
      <label className="text-sm">{t('colPlot')}<input value={f.plotNo} onChange={upd('plotNo')} className={inp} /></label>
      <label className="text-sm">{t('colBlock')}<input value={f.blockNo} onChange={upd('blockNo')} className={inp} /></label>
      <label className="text-sm">{t('colOwner')}<input value={f.originalOwner} onChange={upd('originalOwner')} className={inp} /></label>
      <label className="text-sm">{t('colCity')}
        <select value={f.cityId} onChange={upd('cityId')} className={inp}>
          <option value="">{t('allCities')}</option>
          {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      {!loggedIn && (
        <label className="text-sm sm:col-span-2">{t('phoneLabel')}
          <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" dir="ltr" placeholder="01xxxxxxxxx" className={inp} required />
        </label>
      )}
      <div className="flex items-center gap-3 sm:col-span-2">
        <button disabled={pending} className="rounded-xl bg-gold px-6 py-2.5 font-bold text-navy-900 disabled:opacity-50">
          {pending ? t('submitting') : t('followSubmit')}
        </button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
      <p className="text-xs text-ink-500 sm:col-span-2">{t('freeServiceNote')}</p>
    </form>
  );
}
