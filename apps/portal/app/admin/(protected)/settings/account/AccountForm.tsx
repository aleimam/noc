'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { PasswordInput } from '@noc/ui';
import { updateAccount, changePassword } from './actions';

const inp = 'block w-full rounded-md border border-graphite/20 bg-transparent px-3 py-2 text-sm';

export function AccountForm({ initial }: { initial: { name: string; email: string } }) {
  const t = useTranslations('admin');
  const locale = useLocale() as 'ar' | 'en';
  const tc = useTranslations('common');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const errText = (e: string) =>
    e === 'wrong_password' ? t('wrongPassword') : e === 'password_short' ? t('passwordShort') : e === 'email_taken' ? t('emailTaken') : t('actionFailed');

  function saveProfile() {
    setMsg(null);
    start(async () => {
      const r = await updateAccount({ name, email });
      setMsg(r.ok ? { ok: true, text: t('accountSaved') } : { ok: false, text: errText(r.error) });
      if (r.ok) router.refresh();
    });
  }
  function savePassword() {
    setPwMsg(null);
    start(async () => {
      const r = await changePassword({ current: cur, next });
      if (r.ok) {
        setPwMsg({ ok: true, text: t('passwordChanged') });
        setCur('');
        setNext('');
      } else setPwMsg({ ok: false, text: errText(r.error) });
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-lg border border-graphite/15 p-4">
        <h2 className="font-semibold text-primary">{t('accountProfile')}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">{t('name')}<input value={name} onChange={(e) => setName(e.target.value)} className={inp} /></label>
          <label className="text-sm">{t('email')}<input value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" className={inp} /></label>
        </div>
        <div className="flex items-center gap-3">
          <button disabled={pending} onClick={saveProfile} className="rounded-md bg-primary px-4 py-2 text-sm text-soft disabled:opacity-50">{tc('save')}</button>
          {msg && <span className={msg.ok ? 'text-sm text-green' : 'text-sm text-red-600'}>{msg.text}</span>}
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-graphite/15 p-4">
        <h2 className="font-semibold text-primary">{t('changePassword')}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">{t('currentPassword')}<PasswordInput value={cur} onChange={setCur} autoComplete="current-password" className={inp} locale={locale} /></label>
          <label className="text-sm">{t('newPassword')}<PasswordInput value={next} onChange={setNext} autoComplete="new-password" className={inp} locale={locale} /></label>
        </div>
        <div className="flex items-center gap-3">
          <button disabled={pending || !cur || !next} onClick={savePassword} className="rounded-md bg-primary px-4 py-2 text-sm text-soft disabled:opacity-50">{t('changePassword')}</button>
          {pwMsg && <span className={pwMsg.ok ? 'text-sm text-green' : 'text-sm text-red-600'}>{pwMsg.text}</span>}
        </div>
      </div>
    </div>
  );
}
