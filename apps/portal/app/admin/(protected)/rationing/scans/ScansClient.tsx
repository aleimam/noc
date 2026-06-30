'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { registerScans, deleteScan } from './actions';
import type { ScanReport } from '../types';

export function ScansManager({ report }: { report: ScanReport }) {
  const t = useTranslations('rationing');
  const tc = useTranslations('common');
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  async function upload() {
    const files = Array.from(ref.current?.files ?? []);
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
        fd.append('file', f);
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
        if (ref.current) ref.current.value = '';
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
      <div className="rounded-xl border border-dashed border-graphite/30 bg-graphite/5 p-6 text-center">
        <div className="text-sm text-graphite/80">{t('scanDropHint')}</div>
        <div className="mt-1 text-xs opacity-60">{t('scanDropSub')}</div>
        <input ref={ref} type="file" accept="image/*" multiple className="mt-3 block w-full text-sm" />
        <div className="mt-3 flex items-center justify-center gap-3">
          <button onClick={upload} disabled={busy} className="rounded-md bg-primary px-5 py-2 text-sm text-soft disabled:opacity-50">
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
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.path} alt="" className="h-10 w-14 rounded border border-graphite/15 object-cover" />
                  </td>
                  <td className="p-2 font-mono text-xs" dir="ltr">{s.fileName}</td>
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
