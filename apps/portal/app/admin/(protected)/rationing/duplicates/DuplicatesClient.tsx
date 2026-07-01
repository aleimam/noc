'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from '@noc/ui';
import { deleteSheet } from '../actions';

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
  createdAt: string;
};
type Group = { key: string; rows: Row[] };

export function DuplicatesClient({ groups, totalDupRows, capped }: { groups: Group[]; totalDupRows: number; capped: boolean }) {
  const t = useTranslations('rationing');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [gone, setGone] = useState<Set<string>>(new Set());

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
      <p className="text-sm">
        <span className="rounded bg-amber-100 px-2 py-0.5 font-medium text-amber-800">{t('duplicateRecordsCount', { n: totalDupRows })}</span>
        {capped && <span className="ms-2 text-xs opacity-60">{t('duplicatesCapped')}</span>}
      </p>

      {groups.map((g) => {
        const rows = g.rows.filter((r) => !gone.has(r.id));
        if (rows.length < 2) return null; // resolved once only one (or none) remains
        const head = rows[0]!;
        return (
          <div key={g.key} className="rounded-lg border border-amber-300/60 bg-amber-50/40 p-3">
            <div className="mb-2 text-sm font-semibold text-primary">
              {head.applicantName} · {head.plotFullRef || `${head.plotNo}${head.blockNo ? ' / ' + head.blockNo : ''}`}
              <span className="ms-2 rounded bg-amber-200/70 px-2 py-0.5 text-xs text-amber-900">{t('copiesN', { n: rows.length })}</span>
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
                      <td className="p-2 font-medium">{r.applicantName}</td>
                      <td className="p-2">{r.plotFullRef || `${r.plotNo}${r.blockNo ? ' / ' + r.blockNo : ''}`}</td>
                      <td className="p-2">{r.cityName ?? '—'}</td>
                      <td className="p-2">{r.originalOwner ?? '—'}</td>
                      <td className="p-2 text-xs opacity-70">{r.batchFile ?? r.sourceFile ?? '—'}</td>
                      <td className="p-2" dir="ltr">{r.createdAt}</td>
                      <td className="p-2 text-end">
                        <button disabled={pending} onClick={() => del(r.id)} className="text-red-600 disabled:opacity-50">{t('delete')}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
