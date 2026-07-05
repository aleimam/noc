'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { isValidPhone } from '@noc/config';
import { updateSetting } from './actions';

export function ContactSettings({ phone, whatsapp }: { phone: string; whatsapp: string }) {
  const t = useTranslations('mp');
  const tc = useTranslations('common');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [p, setP] = useState(phone);
  const [w, setW] = useState(whatsapp);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  function save() {
    setSaved(false);
    setError('');
    if (p.trim() && !isValidPhone(p)) { setError(tc('phoneInvalid')); return; }
    start(async () => {
      const r1 = await updateSetting('alswarey_phone', p);
      if (!r1.ok) { setError(tc('phoneInvalid')); return; }
      await updateSetting('alswarey_whatsapp', w);
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-graphite/15 p-4">
      <h2 className="font-semibold text-primary">{t('alswareyContact')}</h2>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">{t('phone1')}
          <input dir="ltr" value={p} onChange={(e) => setP(e.target.value)} className="block rounded-md border border-graphite/20 bg-transparent px-3 py-2 text-sm" />
        </label>
        <label className="text-sm">{t('hasWhatsapp')}
          <input dir="ltr" value={w} onChange={(e) => setW(e.target.value)} className="block rounded-md border border-graphite/20 bg-transparent px-3 py-2 text-sm" />
        </label>
        <button disabled={pending} onClick={save} className="rounded-md bg-primary px-4 py-2 text-sm text-soft disabled:opacity-50">{t('save')}</button>
        {saved && <span className="text-sm text-green">✓</span>}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
