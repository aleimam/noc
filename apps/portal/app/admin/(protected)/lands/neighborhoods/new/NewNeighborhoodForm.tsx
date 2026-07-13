'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { upsertNeighborhood } from '../../actions';

const inp = 'w-full rounded border border-graphite/20 bg-transparent px-3 py-2 text-sm';

export function NewNeighborhoodForm({ districtId }: { districtId: string }) {
  const t = useTranslations('lands');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [ar, setAr] = useState('');
  const [en, setEn] = useState('');
  const [err, setErr] = useState('');

  function save() {
    if (!ar.trim()) return;
    setErr('');
    start(async () => {
      const r = await upsertNeighborhood({ districtId, nameAr: ar.trim(), nameEn: en.trim() || ar.trim() });
      if (r.ok && r.id) router.push(`/admin/lands/neighborhoods/${r.id}/edit`);
      else setErr(r.ok ? 'failed' : r.error);
    });
  }

  return (
    <div className="max-w-md space-y-3">
      <label className="block text-sm">{t('nameAr')}<input value={ar} onChange={(e) => setAr(e.target.value)} className={inp} autoFocus onKeyDown={(e) => e.key === 'Enter' && save()} /></label>
      <label className="block text-sm">{t('nameEn')}<input dir="ltr" value={en} onChange={(e) => setEn(e.target.value)} className={inp} onKeyDown={(e) => e.key === 'Enter' && save()} /></label>
      <p className="text-xs opacity-60">{t('addNeighborhoodHint')}</p>
      {err && <p className="text-sm text-red-600">{err === 'duplicate' ? t('dupNeighborhood') : (t('actionFailed') ?? '!')}</p>}
      <button disabled={pending || !ar.trim()} onClick={save} className="rounded bg-primary px-5 py-2 text-sm text-soft disabled:opacity-50">
        {pending ? t('sending') : `+ ${t('addNeighborhood')}`}
      </button>
    </div>
  );
}
