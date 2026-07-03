'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast, Lightbox } from '@noc/ui';
import { reviewRow } from './actions';
import { updateSheet } from '../actions';

type Row = {
  id: string;
  applicantName: string;
  plotNo: string;
  blockNo: string;
  plotFullRef: string | null;
  cityName: string | null;
  originalOwner: string | null;
  remarks: string | null;
  scanPath: string | null;
};
type Draft = { applicantName: string; plotNo: string; blockNo: string; city: string; originalOwner: string };

const edInp = 'w-full rounded border border-graphite/25 bg-transparent px-2 py-1 text-sm';

export function ReviewClient({ rows }: { rows: Row[] }) {
  const t = useTranslations('rationing');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [zoom, setZoom] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  function startEdit(r: Row) {
    setEditId(r.id);
    setDraft({ applicantName: r.applicantName, plotNo: r.plotNo, blockNo: r.blockNo, city: r.cityName ?? '', originalOwner: r.originalOwner ?? '' });
  }

  // Verify only (no edit): clear the review flag.
  function verify(id: string) {
    start(async () => {
      await reviewRow(id);
      router.refresh();
    });
  }

  // Save the edited record; optionally also clear the review flag ("Save & verify").
  function save(id: string, alsoVerify: boolean) {
    if (!draft) return;
    start(async () => {
      const r = await updateSheet({ id, ...draft });
      if (!r.ok) { toast(t('err_failed'), 'error'); return; }
      if (alsoVerify) await reviewRow(id);
      setEditId(null);
      setDraft(null);
      toast(t('savedOk'));
      router.refresh();
    });
  }

  if (rows.length === 0) return <p className="py-12 text-center opacity-60">{t('reviewEmpty')}</p>;

  return (
    <div className="overflow-x-auto rounded-lg border border-graphite/15">
      <table className="w-full text-sm">
        <thead className="opacity-60">
          <tr>
            <th className="p-2 text-start">{t('colApplicant')}</th>
            <th className="p-2 text-start">{t('colPlot')}</th>
            <th className="p-2 text-start">{t('colCity')}</th>
            <th className="p-2 text-start">{t('colOwner')}</th>
            <th className="p-2 text-start">{t('colRemarks')}</th>
            <th className="p-2 text-start">{t('photo')}</th>
            <th className="p-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-graphite/10 align-top">
              {editId === r.id && draft ? (
                <>
                  <td className="p-2"><input value={draft.applicantName} onChange={(e) => setDraft({ ...draft, applicantName: e.target.value })} className={`${edInp} w-64`} /></td>
                  <td className="p-2">
                    <div className="flex gap-1" dir="ltr">
                      <input value={draft.plotNo} onChange={(e) => setDraft({ ...draft, plotNo: e.target.value })} placeholder={t('colPlot')} className={`${edInp} w-20`} />
                      <input value={draft.blockNo} onChange={(e) => setDraft({ ...draft, blockNo: e.target.value })} placeholder={t('colBlock')} className={`${edInp} w-20`} />
                    </div>
                  </td>
                  <td className="p-2"><input value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} className={`${edInp} w-32`} /></td>
                  <td className="p-2"><input value={draft.originalOwner} onChange={(e) => setDraft({ ...draft, originalOwner: e.target.value })} className={`${edInp} w-40`} /></td>
                  <td className="max-w-[14rem] p-2 text-amber-700">{r.remarks ?? '—'}</td>
                  <td className="p-2">
                    {r.scanPath ? (
                      <button type="button" onClick={() => setZoom(r.scanPath)} className="inline-flex items-center gap-1 rounded border border-graphite/25 px-2 py-1 text-accent hover:bg-graphite/10">🖼 {t('viewPhoto')}</button>
                    ) : (
                      <span className="text-xs opacity-40">{t('noPhoto')}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap p-2 text-end">
                    <button disabled={pending} onClick={() => save(r.id, false)} className="px-2 py-1 text-accent disabled:opacity-50">{t('save')}</button>
                    <button disabled={pending} onClick={() => save(r.id, true)} className="px-2 py-1 text-green disabled:opacity-50">{t('saveAndVerify')}</button>
                    <button disabled={pending} onClick={() => { setEditId(null); setDraft(null); }} className="px-2 py-1 opacity-70">{t('cancel')}</button>
                  </td>
                </>
              ) : (
                <>
                  <td className="p-2">
                    <button type="button" onClick={() => startEdit(r)} className="text-start font-medium text-accent hover:underline" title={t('edit')}>
                      {r.applicantName}
                    </button>
                  </td>
                  <td className="p-2">{r.plotFullRef || (r.plotNo ? `${r.plotNo}${r.blockNo ? ' / ' + r.blockNo : ''}` : '—')}</td>
                  <td className="p-2">{r.cityName ?? '—'}</td>
                  <td className="p-2">{r.originalOwner ?? '—'}</td>
                  <td className="max-w-[14rem] p-2 text-amber-700">{r.remarks ?? '—'}</td>
                  <td className="p-2">
                    {r.scanPath ? (
                      <button type="button" onClick={() => setZoom(r.scanPath)} className="inline-flex items-center gap-1 rounded border border-graphite/25 px-2 py-1 text-accent hover:bg-graphite/10">🖼 {t('viewPhoto')}</button>
                    ) : (
                      <span className="text-xs opacity-40">{t('noPhoto')}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap p-2 text-end">
                    <button disabled={pending} onClick={() => startEdit(r)} className="px-2 py-1 text-accent disabled:opacity-50" title={t('edit')}>✎ {t('edit')}</button>
                    <button disabled={pending} onClick={() => verify(r.id)} className="px-2 py-1 text-green disabled:opacity-50">{t('markVerified')}</button>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {zoom && <Lightbox src={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}
