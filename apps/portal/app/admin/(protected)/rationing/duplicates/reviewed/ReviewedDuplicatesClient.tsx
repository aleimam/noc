'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from '@noc/ui';
import { unmarkDupReviewed } from '../../actions';

type Row = {
  id: string;
  applicantName: string;
  plotNo: string;
  blockNo: string;
  plotFullRef: string | null;
  cityName: string | null;
  originalOwner: string | null;
};
type Group = { key: string; reviewedAt: string; rows: Row[] };

export function ReviewedDuplicatesClient({ groups }: { groups: Group[] }) {
  const t = useTranslations('rationing');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [gone, setGone] = useState<Set<string>>(new Set());

  function unreview(key: string) {
    start(async () => {
      const r = await unmarkDupReviewed(key);
      if (r.ok) {
        setGone((s) => new Set(s).add(key));
        toast(t('movedBack'));
        router.refresh();
      } else {
        toast(t('err_failed'), 'error');
      }
    });
  }

  const visible = groups.filter((g) => !gone.has(g.key));
  if (visible.length === 0) return <p className="py-12 text-center opacity-60">{t('reviewedEmpty')}</p>;

  return (
    <div className="space-y-4">
      {visible.map((g) => {
        const head = g.rows[0];
        return (
          <div key={g.key} className="rounded-lg border border-green/40 bg-green/5 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-primary">
                {head ? `${head.applicantName} · ${head.plotFullRef || `${head.plotNo}${head.blockNo ? ' / ' + head.blockNo : ''}`}` : g.key}
                <span className="ms-2 rounded bg-green/15 px-2 py-0.5 text-xs text-green">✓ {t('notDuplicate')}</span>
                <span className="ms-2 text-xs opacity-60">{t('reviewedOn')} {g.reviewedAt}</span>
              </div>
              <button disabled={pending} onClick={() => unreview(g.key)} className="rounded-md border border-graphite/30 px-3 py-1 text-xs font-medium text-accent hover:bg-graphite/10 disabled:opacity-50">
                ↩ {t('moveBackToDuplicates')}
              </button>
            </div>
            {g.rows.length > 0 && (
              <div className="overflow-x-auto rounded border border-graphite/15 bg-paper">
                <table className="w-full text-sm">
                  <thead className="opacity-60">
                    <tr>
                      <th className="p-2 text-start">{t('colApplicant')}</th>
                      <th className="p-2 text-start">{t('colPlot')}</th>
                      <th className="p-2 text-start">{t('colCity')}</th>
                      <th className="p-2 text-start">{t('colOwner')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.rows.map((r) => (
                      <tr key={r.id} className="border-t border-graphite/10">
                        <td className="p-2 font-medium">
                          <a href={`/rationing/${r.id}`} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{r.applicantName}</a>
                        </td>
                        <td className="p-2">{r.plotFullRef || `${r.plotNo}${r.blockNo ? ' / ' + r.blockNo : ''}`}</td>
                        <td className="p-2">{r.cityName ?? '—'}</td>
                        <td className="p-2">{r.originalOwner ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
