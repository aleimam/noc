'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Lightbox } from '@noc/ui';
import { reviewRow } from './actions';

type Row = { id: string; applicantName: string; plotFullRef: string | null; cityName: string | null; remarks: string | null; scanPath: string | null };

export function ReviewClient({ rows }: { rows: Row[] }) {
  const t = useTranslations('rationing');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [zoom, setZoom] = useState<string | null>(null);

  function act(id: string, name?: string) {
    start(async () => {
      await reviewRow(id, name);
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
            <th className="p-2 text-start">{t('colRemarks')}</th>
            <th className="p-2 text-start">{t('photo')}</th>
            <th className="p-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-graphite/10 align-top">
              <td className="p-2">
                <input
                  defaultValue={r.applicantName}
                  onChange={(e) => setEdits((s) => ({ ...s, [r.id]: e.target.value }))}
                  className="w-64 rounded border border-graphite/20 bg-transparent px-2 py-1"
                />
              </td>
              <td className="p-2">{r.plotFullRef ?? '—'}{r.cityName ? ` · ${r.cityName}` : ''}</td>
              <td className="max-w-[18rem] p-2 text-amber-700">{r.remarks ?? '—'}</td>
              <td className="p-2">
                {r.scanPath ? (
                  <button type="button" onClick={() => setZoom(r.scanPath)} className="inline-flex items-center gap-1 rounded border border-graphite/25 px-2 py-1 text-accent hover:bg-graphite/10">
                    🖼 {t('viewPhoto')}
                  </button>
                ) : (
                  <span className="text-xs opacity-40">{t('noPhoto')}</span>
                )}
              </td>
              <td className="whitespace-nowrap p-2 text-end">
                {edits[r.id] !== undefined && edits[r.id] !== r.applicantName ? (
                  <button disabled={pending} onClick={() => act(r.id, edits[r.id])} className="px-2 py-1 text-green disabled:opacity-50">{t('saveAndVerify')}</button>
                ) : (
                  <button disabled={pending} onClick={() => act(r.id)} className="px-2 py-1 text-green disabled:opacity-50">{t('markVerified')}</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {zoom && <Lightbox src={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}
