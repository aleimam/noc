'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { followArea } from './actions';

const inp = 'w-full rounded-md border border-graphite/20 bg-transparent px-3 py-2 text-sm';

export function FollowArea({ neighborhoodId }: { neighborhoodId: string }) {
  const t = useTranslations('lands');
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pending, start] = useTransition();

  if (done) return <p className="rounded-md bg-green/10 px-4 py-3 text-sm text-green">{t('registered')}</p>;

  return (
    <div className="rounded-lg border border-green/40 bg-green/5 p-4">
      <p className="font-medium text-primary">{t('followCta')}</p>
      {open ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!phone.trim()) return;
            start(async () => {
              const r = await followArea({ neighborhoodId, name, phone });
              if (r.ok) setDone(true);
            });
          }}
          className="mt-3 flex flex-wrap items-end gap-2"
        >
          <label className="text-sm">{t('name')}<input value={name} onChange={(e) => setName(e.target.value)} className={inp} /></label>
          <label className="text-sm">{t('phone')}<input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" className={inp} required /></label>
          <button disabled={pending} className="rounded-md bg-primary px-4 py-2 text-sm text-soft disabled:opacity-50">{pending ? t('sending') : t('send')}</button>
        </form>
      ) : (
        <button onClick={() => setOpen(true)} className="mt-3 rounded-md bg-green px-4 py-2 text-sm font-semibold text-white">{t('followLand')}</button>
      )}
    </div>
  );
}
