'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { compressImage, FileDropzone } from '@noc/ui';
import { registerScans, deleteScan, recordsForScan, type ScanRecord } from './actions';
import type { ScanReport } from '../types';

export function ScansManager({ report }: { report: ScanReport }) {
  const t = useTranslations('rationing');
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [open, setOpen] = useState<{ fileName: string; path: string } | null>(null);
  const [records, setRecords] = useState<ScanRecord[] | null>(null);

  function openScan(fileName: string, path: string) {
    setOpen({ fileName, path });
    setRecords(null);
    start(async () => setRecords(await recordsForScan(fileName)));
  }

  async function upload() {
    if (!files.length) {
      setMsg({ ok: false, text: t('err_no_file') });
      return;
    }
    setBusy(true);
    setMsg(null);
    setProgress({ done: 0, total: files.length });
    const registered: { fileName: string; path: string; mime: string; attachmentId?: string }[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i]!;
        const fd = new FormData();
        // keep scans legible — higher resolution cap than the gallery default
        fd.append('file', await compressImage(f, { maxDim: 2400, quality: 0.85 }));
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json?.attachment) {
          registered.push({ fileName: f.name, path: json.attachment.path, mime: f.type || 'image/jpeg', attachmentId: json.attachment.id });
        }
        setProgress({ done: i + 1, total: files.length });
      }
      const r = await registerScans(registered);
      if (r.ok) {
        setMsg({ ok: true, text: t('scansUploaded', { n: registered.length }) });
        setFiles([]);
        router.refresh();
      } else {
        setMsg({ ok: false, text: t('err_failed') });
      }
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  function del(id: string) {
    if (!confirm(t('confirmDeleteScan'))) return;
    start(async () => {
      await deleteScan(id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <FileDropzone
          accept="image/*"
          multiple
          onFiles={(fs) => { setFiles(fs); setMsg(null); }}
          label={t('chooseImages')}
          hint={t('scanDropSub')}
          selectedName={files.length ? t('nFilesSelected', { n: files.length }) : undefined}
          busy={busy}
        />
        <div className="flex items-center gap-3">
          <button onClick={upload} disabled={busy || !files.length} className="rounded-md bg-primary px-5 py-2 text-sm text-soft disabled:opacity-50">
            {busy && progress ? t('uploadingN', { done: progress.done, total: progress.total }) : t('uploadScans')}
          </button>
          {msg && <span className={msg.ok ? 'text-sm text-green' : 'text-sm text-red-600'}>{msg.text}</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t('matchedScans')} value={report.matchedScans} tone="green" />
        <Stat label={t('rowsCovered')} value={report.rowsCovered} />
        <Stat label={t('orphanScans')} value={report.orphanScans} tone="amber" />
        <Stat label={t('rowsMissingScan')} value={report.rowsMissing} tone="amber" />
      </div>

      {report.scans.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-graphite/15">
          <table className="w-full text-sm">
            <thead className="opacity-60">
              <tr>
                <th className="p-2 text-start">{t('preview')}</th>
                <th className="p-2 text-start">{t('fileName')}</th>
                <th className="p-2 text-start">{t('status')}</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {report.scans.map((s) => (
                <tr key={s.id} className="border-t border-graphite/10">
                  <td className="p-2">
                    <button type="button" onClick={() => openScan(s.fileName, s.path)} title={t('showRecords')}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.path} alt="" className="h-10 w-14 cursor-pointer rounded border border-graphite/15 object-cover hover:ring-2 hover:ring-accent" />
                    </button>
                  </td>
                  <td className="p-2 font-mono text-xs" dir="ltr">
                    <button type="button" onClick={() => openScan(s.fileName, s.path)} className="text-accent hover:underline">{s.fileName}</button>
                  </td>
                  <td className="p-2">
                    {s.matchedRows > 0 ? (
                      <span className="rounded bg-green/10 px-2 py-0.5 text-green">{t('matchedNRows', { n: s.matchedRows })}</span>
                    ) : (
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800">{t('orphanNoRows')}</span>
                    )}
                  </td>
                  <td className="p-2 text-end">
                    <button disabled={pending} onClick={() => del(s.id)} className="text-red-600 disabled:opacity-50">{t('delete')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" onClick={() => setOpen(null)}>
          <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-xl bg-paper p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="font-mono text-sm" dir="ltr">{open.fileName}</h3>
              <button onClick={() => setOpen(null)} className="rounded-lg bg-graphite/10 px-3 py-1 text-lg" aria-label={t('close')}>✕</button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={open.path} alt="" className="w-full rounded-lg border border-graphite/15 object-contain" />
              <div>
                <div className="mb-2 text-sm font-semibold text-primary">{t('recordsOnPhoto')} {records ? `(${records.length})` : ''}</div>
                {records === null ? (
                  <p className="text-sm opacity-60">{t('analyzing')}</p>
                ) : records.length === 0 ? (
                  <p className="text-sm opacity-60">{t('orphanNoRows')}</p>
                ) : (
                  <ul className="space-y-1.5">
                    {records.map((r) => (
                      <li key={r.id} className="rounded border border-graphite/15 p-2 text-sm">
                        <a href={`/rationing/${r.id}`} target="_blank" rel="noopener noreferrer" className="font-medium text-accent hover:underline">{r.applicantName}</a>
                        <div className="text-xs opacity-70">
                          {(r.plotFullRef || `${r.plotNo}${r.blockNo ? ' / ' + r.blockNo : ''}`)}{r.cityName ? ` · ${r.cityName}` : ''}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
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
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
