'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { setSetting, sendTestSms } from './actions';

type S = { provider: string; username: string; password: string; sender: string; environment: string };
const inp = 'block w-full rounded-md border border-graphite/20 bg-transparent px-3 py-2 text-sm';

export function SmsSettings({ initial }: { initial: S }) {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState<S>(initial);
  const [saved, setSaved] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testMsg, setTestMsg] = useState('');

  const up = (k: keyof S) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  function save() {
    setSaved(false);
    start(async () => {
      await setSetting('sms_provider', f.provider);
      await setSetting('sms_username', f.username);
      await setSetting('sms_sender', f.sender);
      await setSetting('sms_environment', f.environment);
      if (f.password) await setSetting('sms_password', f.password); // blank = keep current
      setSaved(true);
      router.refresh();
    });
  }
  function test() {
    setTestMsg('');
    start(async () => {
      const r = await sendTestSms(testPhone);
      setTestMsg(r.ok ? t('smsTestOk') : `${t('smsTestFail')}: ${r.error}`);
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-graphite/15 p-4">
      <div>
        <h2 className="font-semibold text-primary">{t('smsTitle')}</h2>
        <p className="text-xs opacity-70">{t('smsHint')}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">{t('smsProvider')}
          <select value={f.provider} onChange={up('provider')} className={inp}>
            <option value="console">{t('smsConsole')}</option>
            <option value="smsmisr">SMS Misr (sms.com.eg)</option>
          </select>
        </label>
        <label className="text-sm">{t('smsEnvironment')}
          <select value={f.environment} onChange={up('environment')} className={inp}>
            <option value="1">{t('smsLive')}</option>
            <option value="2">{t('smsTestEnv')}</option>
          </select>
        </label>
        <label className="text-sm">{t('smsUsername')}<input value={f.username} onChange={up('username')} dir="ltr" className={inp} /></label>
        <label className="text-sm">{t('smsPassword')}<input value={f.password} onChange={up('password')} type="password" dir="ltr" placeholder="••••••" className={inp} /></label>
        <label className="text-sm sm:col-span-2">{t('smsSender')}<input value={f.sender} onChange={up('sender')} dir="ltr" className={inp} /></label>
      </div>
      <div className="flex items-center gap-3">
        <button disabled={pending} onClick={save} className="rounded-md bg-primary px-4 py-2 text-sm text-soft disabled:opacity-50">{tc('save')}</button>
        {saved && <span className="text-sm text-green">✓</span>}
      </div>
      <div className="mt-1 flex flex-wrap items-end gap-3 border-t border-graphite/10 pt-3">
        <label className="text-sm">{t('smsTest')}<input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} dir="ltr" placeholder="01XXXXXXXXX" className={inp} /></label>
        <button disabled={pending || !testPhone.trim()} onClick={test} className="rounded-md border border-graphite/25 px-4 py-2 text-sm hover:bg-graphite/10 disabled:opacity-50">{t('smsSendTest')}</button>
        {testMsg && <span className="text-sm">{testMsg}</span>}
      </div>
    </div>
  );
}
