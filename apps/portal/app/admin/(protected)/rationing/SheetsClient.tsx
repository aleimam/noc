'use client';

import { useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { previewImport, commitImport, deleteBatch, setInquiryStatus } from './actions';
import type { PreviewResult } from './types';

const ERR_KEY = {
  no_file: 'err_no_file',
  empty: 'err_empty',
  no_rows: 'err_no_rows',
  parse_failed: 'err_parse_failed',
  commit_failed: 'err_failed',
  failed: 'err_failed',
} as const;

type Conflict = 'skip' | 'update' | 'keepBoth';

export function ImportSheets() {
  const t = useTranslations('rationing');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [preview, setPreview] = useState<Extract<PreviewResult, { ok: true }> | null>(null);
  // Independent defaults: keep both copies of in-file repeats; ignore rows already on the server.
  const [fileConflict, setFileConflict] = useState<Conflict>('keepBoth');
  const [serverConflict, setServerConflict] = useState<Conflict>('skip');
  const ref = useRef<HTMLInputElement>(null);

  const errText = (e: string) => t(ERR_KEY[e as keyof typeof ERR_KEY] ?? 'err_failed');

  function doPreview() {
    const file = ref.current?.files?.[0];
    if (!file) {
      setMsg({ ok: false, text: t('err_no_file') });
      return;
    }
    setMsg(null);
    const fd = new FormData();
    fd.append('file', file);
    start(async () => {
      const r = await previewImport(fd);
      if (r.ok) setPreview(r);
      else setMsg({ ok: false, text: errText(r.error) });
    });
  }

  function doCommit() {
    const file = ref.current?.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('fileConflict', fileConflict);
    fd.append('serverConflict', serverConflict);
    start(async () => {
      const r = await commitImport(fd);
      if (r.ok) {
        setMsg({ ok: true, text: t('importSummary', { created: r.created, updated: r.updated, dup: r.duplicates }) });
        setPreview(null);
        if (ref.current) ref.current.value = '';
        router.refresh();
      } else {
        setMsg({ ok: false, text: errText(r.error) });
      }
    });
  }

  return (
    <div className="space-y-4 rounded-lg border border-graphite/15 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <input ref={ref} type="file" accept=".xlsx,.xls" className="text-sm" onChange={() => setPreview(null)} />
        <button onClick={doPreview} disabled={pending} className="rounded-md bg-primary px-4 py-2 text-sm text-soft disabled:opacity-50">
          {pending && !preview ? t('analyzing') : t('previewImport')}
        </button>
        <a href="/admin/rationing/sheets/template" className="text-sm text-accent">{t('downloadTemplate')}</a>
        {msg && <span className={msg.ok ? 'text-sm text-green' : 'text-sm text-red-600'}>{msg.text}</span>}
      </div>

      {preview && (
        <div className="space-y-4 rounded-lg border border-accent/40 bg-accent/5 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-primary">{t('previewTitle')}</h3>
            <span className="text-xs opacity-60">{preview.fileName}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Stat label={t('total')} value={preview.summary.total} />
            <Stat label={t('willAdd')} value={preview.summary.newCount} tone="green" />
            <Stat label={t('dupInFile')} value={preview.summary.dupFileCount} tone="amber" />
            <Stat label={t('dupOnServer')} value={preview.summary.dupServerCount} tone="amber" />
            <Stat label={t('flaggedRows')} value={preview.summary.flaggedCount} tone="amber" />
          </div>

          {preview.summary.newCities.length > 0 && (
            <p className="text-sm">
              <span className="opacity-70">{t('newCities')}: </span>
              {preview.summary.newCities.map((c) => (
                <span key={c} className="me-1 inline-block rounded bg-green/10 px-2 py-0.5 text-green">{c}</span>
              ))}
            </p>
          )}

          {preview.summary.dupFileCount > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('conflictFilePrompt')}</p>
              <div className="flex flex-wrap gap-4 text-sm">
                {(['keepBoth', 'skip'] as Conflict[]).map((c) => (
                  <label key={c} className="flex items-center gap-2">
                    <input type="radio" name="fileConflict" checked={fileConflict === c} onChange={() => setFileConflict(c)} />
                    {t(`conflict_${c}`)}
                  </label>
                ))}
              </div>
            </div>
          )}

          {preview.summary.dupServerCount > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('conflictServerPrompt')}</p>
              <div className="flex flex-wrap gap-4 text-sm">
                {(['skip', 'update', 'keepBoth'] as Conflict[]).map((c) => (
                  <label key={c} className="flex items-center gap-2">
                    <input type="radio" name="serverConflict" checked={serverConflict === c} onChange={() => setServerConflict(c)} />
                    {t(`conflict_${c}`)}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="max-h-80 overflow-auto rounded-lg border border-graphite/15">
            <table className="w-full whitespace-nowrap text-sm">
              <thead className="sticky top-0 bg-paper">
                <tr className="opacity-60">
                  <th className="p-2 text-start">#</th>
                  <th className="p-2 text-start">{t('colApplicant')}</th>
                  <th className="p-2 text-start">{t('expandedNames')}</th>
                  <th className="p-2 text-start">{t('colPlot')}</th>
                  <th className="p-2 text-start">{t('colBlock')}</th>
                  <th className="p-2 text-start">{t('colCity')}</th>
                  <th className="p-2 text-start">{t('status')}</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.rowNumber} className="border-t border-graphite/10">
                    <td className="p-2 opacity-50">{r.rowNumber}</td>
                    <td className="p-2 font-medium">
                      {r.applicantName}
                      {r.flagged && <span className="ms-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">{t('needsReview')}</span>}
                    </td>
                    <td className="p-2 text-xs opacity-80">{r.names.length > 1 ? r.names.join(' · ') : '—'}</td>
                    <td className="p-2">{r.plotNo}</td>
                    <td className="p-2">{r.blockNo || '—'}</td>
                    <td className="p-2">{r.city ?? '—'}</td>
                    <td className="p-2">
                      {r.status === 'new' ? (
                        <span className="text-green">{t('new')}</span>
                      ) : r.status === 'dupFile' ? (
                        <span className="text-amber-700">{t('dupInFile')}</span>
                      ) : (
                        <span className="text-amber-700">{t('dupOnServer')}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.summary.total > preview.rows.length && (
              <p className="p-2 text-center text-xs opacity-60">{t('previewCapped', { shown: preview.rows.length, total: preview.summary.total })}</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button onClick={doCommit} disabled={pending} className="rounded-md bg-green px-5 py-2 text-sm text-soft disabled:opacity-50">
              {pending ? t('importing') : t('confirmImport')}
            </button>
            <button onClick={() => setPreview(null)} disabled={pending} className="px-3 py-2 text-sm opacity-70">
              {t('cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'green' | 'amber' }) {
  const color = tone === 'green' ? 'text-green' : tone === 'amber' ? 'text-amber-700' : 'text-primary';
  return (
    <div className="rounded-lg bg-paper p-3">
      <div className="text-xs opacity-60">{label}</div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

export function DeleteBatchButton({ id }: { id: string }) {
  const t = useTranslations('rationing');
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!confirm(t('confirmDeleteBatch'))) return;
        start(async () => {
          await deleteBatch(id);
          router.refresh();
        });
      }}
      className="text-sm text-red-600 disabled:opacity-50"
    >
      {t('deleteBatch')}
    </button>
  );
}

export function InquiryActions({ id, status }: { id: string; status: 'OPEN' | 'MATCHED' | 'CLOSED' }) {
  const t = useTranslations('rationing');
  const router = useRouter();
  const [pending, start] = useTransition();
  const act = (s: 'OPEN' | 'MATCHED' | 'CLOSED') =>
    start(async () => {
      await setInquiryStatus(id, s);
      router.refresh();
    });
  return (
    <div className="flex items-center gap-3">
      {status !== 'MATCHED' && (
        <button disabled={pending} onClick={() => act('MATCHED')} className="text-xs text-green disabled:opacity-50">{t('markMatched')}</button>
      )}
      {status !== 'CLOSED' && (
        <button disabled={pending} onClick={() => act('CLOSED')} className="text-xs opacity-70 disabled:opacity-50">{t('markClosed')}</button>
      )}
      {status !== 'OPEN' && (
        <button disabled={pending} onClick={() => act('OPEN')} className="text-xs text-accent disabled:opacity-50">{t('reopen')}</button>
      )}
    </div>
  );
}
