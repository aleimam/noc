'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { upsertDistrict } from '../../actions';

const inp = 'w-full rounded border border-graphite/20 bg-transparent px-3 py-2 text-sm';

export function NewDistrictForm({ cities }: { cities: { id: string; name: string }[] }) {
  const t = useTranslations('lands');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [ar, setAr] = useState('');
  const [en, setEn] = useState('');
  const [cityId, setCityId] = useState('');
  const [err, setErr] = useState('');

  function save() {
    if (!ar.trim()) return;
    setErr('');
    start(async () => {
      const r = await upsertDistrict({ nameAr: ar.trim(), nameEn: en.trim() || ar.trim(), cityId: cityId || null });
      if (r.ok && r.id) router.push(`/admin/lands/districts/${r.id}/edit`);
      else setErr(t('actionFailed'));
    });
  }

  return (
    <div className="max-w-md space-y-3">
      <label className="block text-sm">{t('nameAr')}<input value={ar} onChange={(e) => setAr(e.target.value)} className={inp} autoFocus onKeyDown={(e) => e.key === 'Enter' && save()} /></label>
      <label className="block text-sm">{t('nameEn')}<input dir="ltr" value={en} onChange={(e) => setEn(e.target.value)} className={inp} onKeyDown={(e) => e.key === 'Enter' && save()} /></label>
      <label className="block text-sm">{t('city')}
        <select value={cityId} onChange={(e) => setCityId(e.target.value)} className={inp}>
          <option value="">—</option>
          {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <p className="text-xs opacity-60">{t('addGeoHint')}</p>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <button disabled={pending || !ar.trim()} onClick={save} className="rounded bg-primary px-5 py-2 text-sm text-soft disabled:opacity-50">
        {pending ? t('sending') : `+ ${t('addDistrict')}`}
      </button>
    </div>
  );
}
