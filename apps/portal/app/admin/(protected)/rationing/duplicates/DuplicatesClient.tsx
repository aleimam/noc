'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast, Lightbox } from '@noc/ui';
import { deleteSheet, markDupReviewed, updateSheet } from '../actions';

type Draft = { applicantName: string; plotNo: string; blockNo: string; city: string; originalOwner: string };
const edInp = 'w-full rounded border border-graphite/25 bg-transparent px-2 py-1 text-sm';

type Row = {
  id: string;
  applicantName: string;
  plotNo: string;
  blockNo: string;
  plotFullRef: string | null;
  cityName: string | null;
  originalOwner: string | null;
  sourceFile: string | null;
  batchFile: string | null;
  scanPath: string | null;
  createdAt: string;
};
type Group = { key: string; rows: Row[] };

export function DuplicatesClient({ groups }: { groups: Group[] }) {
  const t = useTranslations('rationing');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [reviewedKeys, setReviewedKeys] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  function startEdit(r: Row) {
    setEditId(r.id);
    setDraft({ applicantName: r.applicantName, plotNo: r.plotNo, blockNo: r.blockNo, city: r.cityName ?? '', originalOwner: r.originalOwner ?? '' });
  }
  function saveEdit() {
    if (!editId || !draft) return;
    start(async () => {
      const r = await updateSheet({ id: editId, ...draft });
      if (r.ok) {
        setEditId(null);
        setDraft(null);
        toast(t('savedOk'));
        router.refresh();
      } else {
        toast(t('err_failed'), 'error');
      }
    });
  }

  function markReviewed(key: string) {
    start(async () => {
      const r = await markDupReviewed(key);
      if (r.ok) {
        setReviewedKeys((s) => new Set(s).add(key));
        toast(t('markedReviewed'));
        router.refresh();
      } else {
        toast(t('err_failed'), 'error');
      }
    });
  }

  function del(id: string) {
    if (!confirm(t('confirmDeleteRecord'))) return;
    start(async () => {
      const r = await deleteSheet(id);
      if (r.ok) {
        setGone((s) => new Set(s).add(id));
        toast(t('deleted'));
        router.refresh();
      } else {
        toast(t('err_failed'), 'error');
      }
    });
  }

  if (groups.length === 0) return <p className="py-12 text-center opacity-60">{t('duplicatesEmpty')}</p>;

  return (
    <div className="space-y-4">
      {groups.map((g) => {
        if (reviewedKeys.has(g.key)) return null; // just moved to the Reviewed page
        const rows = g.rows.filter((r) => !gone.has(r.id));
        if (rows.length < 2) return null; // resolved once only one (or none) remains
        const head = rows[0]!;
        return (
          <div key={g.key} className="rounded-lg border border-amber-300/60 bg-amber-50/40 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-primary">
                {head.applicantName} · {head.plotFullRef || `${head.plotNo}${head.blockNo ? ' / ' + head.blockNo : ''}`}
                <span className="ms-2 rounded bg-amber-200/70 px-2 py-0.5 text-xs text-amber-900">{t('copiesN', { n: rows.length })}</span>
              </div>
              <button disabled={pending} onClick={() => markReviewed(g.key)} className="rounded-md border border-green/40 px-3 py-1 text-xs font-medium text-green hover:bg-green/10 disabled:opacity-50">
                ✓ {t('markNotDuplicate')}
              </button>
            </div>
            <div className="overflow-x-auto rounded border border-graphite/15 bg-paper">
              <table className="w-full text-sm">
                <thead className="opacity-60">
                  <tr>
                    <th className="p-2 text-start">{t('colApplicant')}</th>
                    <th className="p-2 text-start">{t('colPlot')}</th>
                    <th className="p-2 text-start">{t('colCity')}</th>
                    <th className="p-2 text-start">{t('colOwner')}</th>
                    <th className="p-2 text-start">{t('fileName')}</th>
                    <th className="p-2 text-start">{t('uploadedAt')}</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-graphite/10">
                      {editId === r.id && draft ? (
                        <>
                          <td className="p-2"><input value={draft.applicantName} onChange={(e) => setDraft({ ...draft, applicantName: e.target.value })} className={edInp} /></td>
                          <td className="p-2">
                            <div className="flex gap-1" dir="ltr">
                              <input value={draft.plotNo} onChange={(e) => setDraft({ ...draft, plotNo: e.target.value })} placeholder={t('colPlot')} className={edInp} />
                              <input value={draft.blockNo} onChange={(e) => setDraft({ ...draft, blockNo: e.target.value })} placeholder={t('colBlock')} className={edInp} />
                            </div>
                          </td>
                          <td className="p-2"><input value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} className={edInp} /></td>
                          <td className="p-2"><input value={draft.originalOwner} onChange={(e) => setDraft({ ...draft, originalOwner: e.target.value })} className={edInp} /></td>
                          <td className="p-2 text-xs opacity-70">{r.batchFile ?? r.sourceFile ?? '—'}</td>
                          <td className="p-2" dir="ltr">{r.createdAt}</td>
                          <td className="whitespace-nowrap p-2 text-end">
                            <button disabled={pending} onClick={saveEdit} className="text-green disabled:opacity-50">{t('save')}</button>
                            <button disabled={pending} onClick={() => { setEditId(null); setDraft(null); }} className="ms-3 opacity-70">{t('cancel')}</button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="p-2 font-medium">{r.applicantName}</td>
                          <td className="p-2">
                            {r.scanPath ? (
                              <button type="button" onClick={() => setZoom(r.scanPath)} className="inline-flex items-center gap-1 text-accent hover:underline" title={t('viewPhoto')}>
                                🖼 {r.plotFullRef || `${r.plotNo}${r.blockNo ? ' / ' + r.blockNo : ''}`}
                              </button>
                            ) : (
                              r.plotFullRef || `${r.plotNo}${r.blockNo ? ' / ' + r.blockNo : ''}`
                            )}
                          </td>
                          <td className="p-2">{r.cityName ?? '—'}</td>
                          <td className="p-2">{r.originalOwner ?? '—'}</td>
                          <td className="p-2 text-xs opacity-70">{r.batchFile ?? r.sourceFile ?? '—'}</td>
                          <td className="p-2" dir="ltr">{r.createdAt}</td>
                          <td className="whitespace-nowrap p-2 text-end">
                            <button disabled={pending} onClick={() => startEdit(r)} className="text-accent disabled:opacity-50">{t('edit')}</button>
                            <button disabled={pending} onClick={() => del(r.id)} className="ms-3 text-red-600 disabled:opacity-50">{t('delete')}</button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
      {zoom && <Lightbox src={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}
