'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { compressImage, FileDropzone } from '@noc/ui';
import { registerScans, deleteScan, renameScan, recordsForScan, type ScanRecord } from './actions';
import type { ScanReport, ScanRow, MissingFile } from '../types';

/** Filename similarity for mismatch suggestions: strip the extension, unify separators,
 *  drop leading zeros in number tokens — «01 07 2026 1.jpeg» ≈ «1 7 2026 01.jpg». */
function normName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_\-.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((tok) => (/^\d+$/.test(tok) ? String(parseInt(tok, 10)) : tok))
    .join(' ');
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m || !n) return m + n;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n]!;
}

/** Best candidate from `pool` for `name`: exact normalized match, else edit distance ≤ 2. */
function closest<T>(name: string, pool: T[], nameOf: (x: T) => string): T | null {
  const target = normName(name);
  let best: T | null = null;
  let bestDist = 3; // only accept ≤ 2
  for (const item of pool) {
    const d = levenshtein(target, normName(nameOf(item)));
    if (d === 0) return item;
    if (d < bestDist) { bestDist = d; best = item; }
  }
  return best;
}

export function ScansManager({ report }: { report: ScanReport }) {
  const t = useTranslations('rationing');
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [open, setOpen] = useState<{ fileName: string; path: string | null } | null>(null);
  const [records, setRecords] = useState<ScanRecord[] | null>(null);
  const [panel, setPanel] = useState<'orphans' | 'missing' | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const orphans = useMemo(() => report.scans.filter((s) => s.matchedRows === 0), [report.scans]);
  // Cross-suggestions between the two problem lists (both are small, so this is cheap).
  const orphanSuggestion = useMemo(() => {
    const m = new Map<string, MissingFile>();
    for (const s of orphans) {
      const hit = closest(s.fileName, report.missingFiles, (f) => f.sourceFile);
      if (hit) m.set(s.id, hit);
    }
    return m;
  }, [orphans, report.missingFiles]);
  const missingSuggestion = useMemo(() => {
    const m = new Map<string, ScanRow>();
    for (const f of report.missingFiles) {
      const hit = closest(f.sourceFile, orphans, (s) => s.fileName);
      if (hit) m.set(f.sourceFile, hit);
    }
    return m;
  }, [orphans, report.missingFiles]);

  function openScan(fileName: string, path: string | null) {
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

  /** Adopt a suggested sourceFile name for a photo → the sheet rows match instantly. */
  function adopt(scanId: string, photoName: string, targetName: string, rows: number) {
    if (!confirm(t('confirmAdopt', { photo: photoName, name: targetName, n: rows }))) return;
    start(async () => {
      const r = await renameScan(scanId, targetName);
      if (!r.ok) alert(r.error === 'name_taken' ? t('nameTaken') : t('err_failed'));
      else router.refresh();
    });
  }

  function copyName(name: string) {
    navigator.clipboard?.writeText(name).then(() => {
      setCopied(name);
      setTimeout(() => setCopied((c) => (c === name ? null : c)), 1500);
    });
  }

  const actBtn = 'min-h-[40px] rounded-md border border-graphite/25 px-3 py-1.5 text-sm hover:bg-graphite/10 disabled:opacity-50';

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
        <Stat
          label={t('orphanScans')}
          value={report.orphanScans}
          tone="amber"
          onClick={report.orphanScans > 0 ? () => setPanel((p) => (p === 'orphans' ? null : 'orphans')) : undefined}
          active={panel === 'orphans'}
          hint={report.orphanScans > 0 ? t('clickToView') : undefined}
        />
        <Stat
          label={t('rowsMissingScan')}
          value={report.rowsMissing}
          tone="amber"
          onClick={report.rowsMissing > 0 ? () => setPanel((p) => (p === 'missing' ? null : 'missing')) : undefined}
          active={panel === 'missing'}
          hint={report.rowsMissing > 0 ? t('clickToView') : undefined}
        />
      </div>

      {panel === 'orphans' && (
        <div className="space-y-3 rounded-xl border-2 border-amber-300 bg-amber-50/60 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold text-amber-900">{t('orphanPanelTitle')} ({orphans.length})</h3>
            <button onClick={() => setPanel(null)} className="rounded-lg bg-graphite/10 px-3 py-1.5 text-sm" aria-label={t('close')}>✕ {t('close')}</button>
          </div>
          <p className="text-xs leading-relaxed opacity-70">{t('orphanPanelHint')}</p>
          {orphans.length === 0 ? (
            <p className="text-sm opacity-60">{t('nonePanel')}</p>
          ) : (
            <ul className="space-y-2">
              {orphans.map((s) => {
                const sug = orphanSuggestion.get(s.id);
                return (
                  <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-graphite/15 bg-paper p-2">
                    <button type="button" onClick={() => openScan(s.fileName, s.path)} title={t('preview')}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.path} alt="" className="h-12 w-16 cursor-pointer rounded border border-graphite/15 object-cover hover:ring-2 hover:ring-accent" />
                    </button>
                    <span className="font-mono text-xs" dir="ltr">{s.fileName}</span>
                    {sug ? (
                      <span className="flex flex-wrap items-center gap-2 rounded-md bg-green/10 px-2 py-1.5 text-xs">
                        {t('closestMatch')}: <b className="font-mono" dir="ltr">{sug.sourceFile}</b> · {t('rowsN', { n: sug.rows })}
                        <button disabled={pending} onClick={() => adopt(s.id, s.fileName, sug.sourceFile, sug.rows)} className="min-h-[36px] rounded-md bg-green px-3 py-1 font-bold text-white disabled:opacity-50">
                          ✓ {t('adoptName')}
                        </button>
                      </span>
                    ) : (
                      <span className="text-xs opacity-50">{t('noCloseMatch')}</span>
                    )}
                    <span className="ms-auto flex items-center gap-2">
                      <button onClick={() => openScan(s.fileName, s.path)} className={actBtn}>{t('preview')}</button>
                      <button disabled={pending} onClick={() => del(s.id)} className={`${actBtn} border-red-300 text-red-600`}>{t('delete')}</button>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {panel === 'missing' && (
        <div className="space-y-3 rounded-xl border-2 border-amber-300 bg-amber-50/60 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold text-amber-900">{t('missingPanelTitle')} ({report.missingFiles.length})</h3>
            <button onClick={() => setPanel(null)} className="rounded-lg bg-graphite/10 px-3 py-1.5 text-sm" aria-label={t('close')}>✕ {t('close')}</button>
          </div>
          <p className="text-xs leading-relaxed opacity-70">{t('missingPanelHint')}</p>
          {report.missingFiles.length === 0 ? (
            <p className="text-sm opacity-60">{t('nonePanel')}</p>
          ) : (
            <ul className="space-y-2">
              {report.missingFiles.map((f) => {
                const sug = missingSuggestion.get(f.sourceFile);
                return (
                  <li key={f.sourceFile} className="flex flex-wrap items-center gap-3 rounded-lg border border-graphite/15 bg-paper p-2">
                    <span className="font-mono text-xs" dir="ltr">{f.sourceFile}</span>
                    <span className="rounded bg-graphite/10 px-2 py-0.5 text-xs">{t('rowsN', { n: f.rows })}</span>
                    {sug && (
                      <span className="flex flex-wrap items-center gap-2 rounded-md bg-green/10 px-2 py-1.5 text-xs">
                        {t('closestPhoto')}:
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={sug.path} alt="" className="h-9 w-12 rounded border border-graphite/15 object-cover" />
                        <b className="font-mono" dir="ltr">{sug.fileName}</b>
                        <button disabled={pending} onClick={() => adopt(sug.id, sug.fileName, f.sourceFile, f.rows)} className="min-h-[36px] rounded-md bg-green px-3 py-1 font-bold text-white disabled:opacity-50">
                          ✓ {t('linkThisPhoto')}
                        </button>
                      </span>
                    )}
                    <span className="ms-auto flex items-center gap-2">
                      <button onClick={() => openScan(f.sourceFile, null)} className={actBtn}>{t('showRows')}</button>
                      <button onClick={() => copyName(f.sourceFile)} className={actBtn}>
                        {copied === f.sourceFile ? t('copied') : `📋 ${t('copyName')}`}
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

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
            <div className={open.path ? 'grid gap-4 md:grid-cols-2' : ''}>
              {open.path && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={open.path} alt="" className="w-full rounded-lg border border-graphite/15 object-contain" />
              )}
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

function Stat({ label, value, tone, onClick, active, hint }: { label: string; value: number; tone?: 'green' | 'amber'; onClick?: () => void; active?: boolean; hint?: string }) {
  const color = tone === 'green' ? 'text-green' : tone === 'amber' ? 'text-amber-700' : 'text-primary';
  const body = (
    <>
      <div className="text-xs opacity-60">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      {hint && <div className="text-[11px] text-accent">{hint} ↓</div>}
    </>
  );
  if (!onClick) return <div className="rounded-lg bg-paper p-3">{body}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={!!active}
      className={`rounded-lg bg-paper p-3 text-start transition hover:ring-2 hover:ring-accent ${active ? 'ring-2 ring-amber-400' : 'ring-1 ring-graphite/10'}`}
    >
      {body}
    </button>
  );
}
