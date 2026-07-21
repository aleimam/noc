'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { runBackupNow, verifyLatest, saveScheduleRetention, saveAlertConfig } from './actions';
import type { BackupFile, BackupsSummary, Schedule, AlertConfig } from './backups';

const pad = (n: number) => String(n).padStart(2, '0');
function fmtWhen(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
function fmtBytes(n: number): string {
  if (n <= 0) return '0';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
}
const hmStr = (s: { h: number; m: number }) => `${pad(s.h)}:${pad(s.m)}`;

type Msg = { ok: boolean; text: string } | null;

export function BackupsClient({
  locale,
  files,
  summary,
  retentionDays,
  schedule,
  alert,
}: {
  locale: 'ar' | 'en';
  files: BackupFile[];
  summary: BackupsSummary;
  retentionDays: number;
  schedule: Schedule;
  alert: AlertConfig;
}) {
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const router = useRouter();

  const [retention, setRetention] = useState(String(retentionDays));
  const [localTime, setLocalTime] = useState(hmStr(schedule.local));
  const [alertEnabled, setAlertEnabled] = useState(alert.enabled);
  const [alertEmail, setAlertEmail] = useState(alert.email);
  const [alertPhone, setAlertPhone] = useState(alert.phone);

  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string>(''); // which action is running
  const [msg, setMsg] = useState<Msg>(null);
  const [logOut, setLogOut] = useState('');

  const kindLabel = (k: BackupFile['kind']) =>
    k === 'db' ? L('قاعدة البيانات', 'Database') : k === 'uploads' ? L('الصور والملفات', 'Uploads') : L('الإعدادات (.env)', 'Config (.env)');

  function act(name: string, fn: () => Promise<{ ok: boolean; log?: string; error?: string }>, okText: string) {
    setBusy(name);
    setMsg(null);
    setLogOut('');
    start(async () => {
      const r = await fn();
      setBusy('');
      if (r.ok) {
        setMsg({ ok: true, text: okText });
        if (r.log) setLogOut(r.log);
        router.refresh();
      } else {
        setMsg({ ok: false, text: L('فشل: ', 'Failed: ') + (r.error ?? '') });
        if (r.error) setLogOut(r.error);
      }
    });
  }

  const saveSched = () => {
    const [lh, lm] = localTime.split(':').map((x) => parseInt(x, 10) || 0);
    act('sched', () => saveScheduleRetention({ localH: lh ?? 2, localM: lm ?? 30, retentionDays: parseInt(retention, 10) || 14 }), L('تم حفظ المواعيد ومدة الاحتفاظ', 'Schedule & retention saved'));
  };
  const saveAlerts = () =>
    act('alerts', () => saveAlertConfig({ enabled: alertEnabled, email: alertEmail, phone: alertPhone }), L('تم حفظ التنبيهات', 'Alerts saved'));

  const inp = 'w-full rounded-md border border-graphite/25 bg-transparent px-3 py-2 text-base';
  const btn = 'rounded-md bg-primary px-4 py-2 text-sm font-bold text-soft disabled:opacity-50';
  const btnSec = 'rounded-md border border-primary px-4 py-2 text-sm font-bold text-primary disabled:opacity-50';

  const dbFiles = files.filter((f) => f.kind === 'db');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-primary">{L('النسخ الاحتياطي', 'Backups')}</h1>
        <p className="mt-1 text-sm opacity-70">
          {L(
            'نسخة يومية تلقائية للبيانات والصور على الخادم (٢:٣٠ صباحًا). النسخ خارج الخادم يتم عبر وحدة النسخ المجدولة بالأسفل.',
            'Automatic daily on-server backup of the database + uploads (02:30). Off-site copies are handled by the scheduled module below.',
          )}
        </p>
      </div>

      {/* Status cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label={L('آخر نسخة', 'Last backup')} value={summary.lastBackupAt ? fmtWhen(summary.lastBackupAt) : '—'} sub="UTC" />
        <Stat label={L('عدد النسخ', 'Backup files')} value={String(summary.fileCount)} sub={fmtBytes(summary.totalSize)} />
        <Stat label={L('المساحة المتاحة', 'Free disk')} value={summary.diskFree != null ? fmtBytes(summary.diskFree) : '—'} />
      </div>

      {/* Instant backup */}
      <section className="space-y-3 rounded-lg border border-graphite/15 p-5">
        <h2 className="font-semibold text-primary">{L('نسخة فورية', 'Back up now')}</h2>
        <p className="text-sm opacity-70">
          {L('يأخذ نسخة جديدة الآن (قاعدة البيانات + الصور + الإعدادات).', 'Takes a fresh backup right now (database + uploads + config).')}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button className={btn} disabled={pending} onClick={() => act('backup', runBackupNow, L('تم إنشاء نسخة جديدة', 'New backup created'))}>
            {busy === 'backup' ? L('جارٍ النسخ…', 'Backing up…') : L('نسخة فورية الآن', 'Back up now')}
          </button>
          <button className={btnSec} disabled={pending} onClick={() => act('verify', verifyLatest, L('النسخ سليمة ✓', 'Backups verified — OK ✓'))}>
            {busy === 'verify' ? L('جارٍ الفحص…', 'Checking…') : L('فحص سلامة النسخ', 'Verify backups')}
          </button>
        </div>
        {msg && <p className={`text-sm ${msg.ok ? 'text-green-600' : 'text-red-600'}`}>{msg.text}</p>}
        {logOut && <pre className="max-h-52 overflow-auto rounded-md bg-graphite/5 p-3 text-xs" dir="ltr">{logOut}</pre>}
      </section>

      {/* History */}
      <section className="space-y-3">
        <h2 className="font-semibold text-primary">{L('النسخ السابقة', 'Previous backups')}</h2>
        {files.length === 0 ? (
          <p className="text-sm opacity-60">{L('لا توجد نسخ بعد.', 'No backups yet.')}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-graphite/15">
            <table className="w-full text-sm">
              <thead className="bg-graphite/5 text-start">
                <tr>
                  <Th>{L('التاريخ (UTC)', 'Date (UTC)')}</Th>
                  <Th>{L('النوع', 'Type')}</Th>
                  <Th>{L('الحجم', 'Size')}</Th>
                  <Th>{L('تحميل', 'Download')}</Th>
                </tr>
              </thead>
              <tbody>
                {files.map((f) => (
                  <tr key={f.kind + f.name} className="border-t border-graphite/10">
                    <td className="px-3 py-2 font-mono text-xs" dir="ltr">{fmtWhen(f.mtime)}</td>
                    <td className="px-3 py-2">{kindLabel(f.kind)}</td>
                    <td className="px-3 py-2" dir="ltr">{fmtBytes(f.size)}</td>
                    <td className="px-3 py-2">
                      {f.kind === 'config' ? (
                        <span className="text-xs opacity-50">{L('على الخادم فقط', 'server only')}</span>
                      ) : (
                        <a
                          className="text-accent hover:underline"
                          href={`/admin/settings/backups/download?kind=${f.kind}&file=${encodeURIComponent(f.name)}`}
                        >
                          {L('تحميل', 'Download')}
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {dbFiles[0] && (
          <a className={`inline-block ${btnSec}`} href={`/admin/settings/backups/download?kind=db&file=${encodeURIComponent(dbFiles[0].name)}`}>
            {L('تحميل أحدث نسخة لقاعدة البيانات', 'Download latest database backup')}
          </a>
        )}
      </section>

      {/* Schedule + retention (LOCAL nightly backup) */}
      <section className="space-y-4 rounded-lg border border-graphite/15 p-5">
        <h2 className="font-semibold text-primary">{L('موعد النسخة اليومية ومدة الاحتفاظ', 'Daily backup time & retention')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={L('موعد النسخة اليومية', 'Daily backup time')}>
            <input type="time" dir="ltr" value={localTime} onChange={(e) => setLocalTime(e.target.value)} className={inp} />
          </Field>
          <Field label={L('مدة الاحتفاظ (بالأيام)', 'Keep backups for (days)')}>
            <input type="number" dir="ltr" min={1} max={365} value={retention} onChange={(e) => setRetention(e.target.value)} className={inp} />
          </Field>
        </div>
        <button className={btn} disabled={pending} onClick={saveSched}>
          {busy === 'sched' ? L('جارٍ الحفظ…', 'Saving…') : L('حفظ المواعيد', 'Save schedule')}
        </button>
      </section>

      {/* Failure alerts */}
      <section className="space-y-4 rounded-lg border border-graphite/15 p-5">
        <h2 className="font-semibold text-primary">{L('تنبيهات عند فشل النسخ', 'Failure alerts')}</h2>
        <p className="text-sm opacity-70">
          {L(
            'ننبّهك بالبريد أو رسالة SMS إذا لم تُنشأ نسخة احتياطية جديدة كالمعتاد (فحص يومي).',
            'We alert you by email or SMS if a fresh backup was not created as expected (checked daily).',
          )}
        </p>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={alertEnabled} onChange={(e) => setAlertEnabled(e.target.checked)} className="h-4 w-4" />
          {L('تفعيل التنبيهات', 'Enable alerts')}
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={L('بريد التنبيه (يمكن أكثر من واحد بفاصلة)', 'Alert email(s) — comma-separated for more than one')}>
            <input dir="ltr" type="text" value={alertEmail} onChange={(e) => setAlertEmail(e.target.value)} placeholder="you@example.com, other@example.com" className={inp} />
          </Field>
          <Field label={L('هاتف التنبيه (SMS)', 'Alert phone (SMS)')}>
            <input dir="ltr" value={alertPhone} onChange={(e) => setAlertPhone(e.target.value)} placeholder="01xxxxxxxxx" className={inp} />
          </Field>
        </div>
        <button className={btn} disabled={pending} onClick={saveAlerts}>
          {busy === 'alerts' ? L('جارٍ الحفظ…', 'Saving…') : L('حفظ التنبيهات', 'Save alerts')}
        </button>
      </section>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'muted' }) {
  return (
    <div className="rounded-lg border border-graphite/15 p-4">
      <div className="text-xs opacity-60">{label}</div>
      <div className={`mt-1 text-lg font-bold ${tone === 'good' ? 'text-green-600' : tone === 'muted' ? 'opacity-50' : 'text-primary'}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs opacity-50" dir="ltr">{sub}</div>}
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-semibold">
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}
function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-start font-semibold">{children}</th>;
}
