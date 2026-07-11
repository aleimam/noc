'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { isValidPhone } from '@noc/config';
import { submitMissedSheetReport } from './actions';

type City = { id: string; name: string };
type Photo = { id: string; path: string };

const inp = 'w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-base';

export function ReportForm({ cities, account }: { cities: City[]; account: { name: string } | null }) {
  const t = useTranslations('rationing');
  const [pending, start] = useTransition();
  const [doneName, setDoneName] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [f, setF] = useState({ reporterName: '', reporterPhone: '', fbDate: '', cityId: '', originalOwner: '', blockNo: '', plotNo: '' });
  const upd = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError('');
    try {
      for (const file of Array.from(files).slice(0, 10 - photos.length)) {
        const fd = new FormData();
        fd.append('file', file);
        const r = await fetch('/api/report-upload', { method: 'POST', body: fd });
        const j = await r.json().catch(() => null);
        if (j?.ok) setPhotos((p) => [...p, { id: j.attachment.id, path: j.attachment.path }]);
        else {
          // A failed photo must never vanish silently — tell the user and stop the batch.
          setError(j?.error === 'rate_limited' ? t('reportRateLimited') : t('registerError'));
          break;
        }
      }
    } finally {
      setBusy(false);
    }
  }

  function submit() {
    setError('');
    // Guests supply a phone; enforce the shared rule before hitting the server.
    if (!account && f.reporterPhone.trim() && !isValidPhone(f.reporterPhone)) { setError(t('phoneInvalid')); return; }
    start(async () => {
      const r = await submitMissedSheetReport({ ...f, photoIds: photos.map((p) => p.id) });
      if (r.ok) setDoneName(r.name);
      else
        setError(
          r.error === 'name_required' ? t('reportNameRequired')
          : r.error === 'invalid_phone' ? t('phoneInvalid')
          : r.error === 'empty' ? t('reportNeedInfo')
          : r.error === 'rate_limited' ? t('reportRateLimited')
          : t('registerError'),
        );
    });
  }

  if (doneName != null) {
    return (
      <div className="rounded-2xl border-2 border-green bg-white p-6 text-center">
        <div className="text-3xl" aria-hidden>🙏</div>
        <div className="mt-2 text-xl font-extrabold text-success">{t('reportThanksTitle', { name: doneName })}</div>
        <p className="mt-2 text-ink-600">{t('reportThanksBody')}</p>
        <Link href="/rationing" className="mt-4 inline-block rounded-xl bg-navy px-5 py-2.5 font-bold text-soft">{t('backToSearch')}</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
      {account ? (
        <p className="rounded-xl bg-navy-50 px-4 py-3 text-navy-800">✓ {t('reportUsingAccount', { name: account.name })}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-base font-medium">{t('reportYourName')}
            <input value={f.reporterName} onChange={upd('reporterName')} className={inp} />
          </label>
          <label className="text-base font-medium">{t('reportYourPhone')}
            <input value={f.reporterPhone} onChange={upd('reporterPhone')} type="tel" dir="ltr" inputMode="tel" placeholder="01xxxxxxxxx" className={inp} />
          </label>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-base font-medium">{t('reportFbDate')}
          <input value={f.fbDate} onChange={upd('fbDate')} type="date" dir="ltr" className={inp} />
        </label>
        <label className="text-base font-medium">{t('colCity')}
          <select value={f.cityId} onChange={upd('cityId')} className={inp}>
            <option value="">—</option>
            {cities.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
        </label>
        <label className="text-base font-medium sm:col-span-2">{t('colOwner')}
          <input value={f.originalOwner} onChange={upd('originalOwner')} className={inp} />
        </label>
        <label className="text-base font-medium">{t('colBlock')}
          <input value={f.blockNo} onChange={upd('blockNo')} className={inp} />
        </label>
        <label className="text-base font-medium">{t('colPlot')}
          <input value={f.plotNo} onChange={upd('plotNo')} className={inp} />
        </label>
      </div>

      <div>
        <div className="text-base font-medium">{t('reportPhotos')}</div>
        {photos.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {photos.map((p) => (
              <div key={p.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.path} alt="" className="h-20 w-20 rounded-lg object-cover ring-1 ring-ink-200" />
                <button type="button" onClick={() => setPhotos((s) => s.filter((x) => x.id !== p.id))} className="absolute -end-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs text-white" aria-label="✕">✕</button>
              </div>
            ))}
          </div>
        )}
        <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed border-ink-300 px-5 py-3 text-base font-bold text-navy-700 hover:border-gold">
          📷 {busy ? '…' : t('reportAddPhotos')}
          <input type="file" accept="image/*" multiple hidden onChange={(e) => { void addPhotos(e.target.files); e.target.value = ''; }} />
        </label>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-red-700">{error}</p>}

      <button onClick={submit} disabled={pending || busy} className="w-full rounded-xl bg-navy px-5 py-3.5 text-lg font-extrabold text-soft disabled:opacity-50 sm:w-auto sm:px-10">
        {pending ? '…' : t('reportSubmit')}
      </button>
    </div>
  );
}
