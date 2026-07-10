'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { runBackupNow, runOffsitePush, testOffsite, saveOffsiteConfig, verifyLatest, saveScheduleRetention, saveAlertConfig, type OffsiteInput } from './actions';
import type { BackupFile, OffsiteConfig, BackupsSummary, Schedule, AlertConfig } from './backups';

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
  offsite,
  pubkey,
  summary,
  retentionDays,
  schedule,
  alert,
}: {
  locale: 'ar' | 'en';
  files: BackupFile[];
  offsite: OffsiteConfig;
  pubkey: string;
  summary: BackupsSummary;
  retentionDays: number;
  schedule: Schedule;
  alert: AlertConfig;
}) {
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const router = useRouter();

  const [enabled, setEnabled] = useState(offsite.enabled);
  const [host, setHost] = useState(offsite.host);
  const [user, setUser] = useState(offsite.user);
  const [port, setPort] = useState(offsite.port);
  const [destPath, setDestPath] = useState(offsite.path);
  const [mirror, setMirror] = useState(offsite.mirror);

  const [retention, setRetention] = useState(String(retentionDays));
  const [localTime, setLocalTime] = useState(hmStr(schedule.local));
  const [offsiteTime, setOffsiteTime] = useState(hmStr(schedule.offsite));
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

  const save = () => {
    const input: OffsiteInput = { enabled, host, user, port, path: destPath, mirror };
    act('save', () => saveOffsiteConfig(input), L('تم حفظ إعدادات النسخ الخارجي', 'Off-site settings saved'));
  };
  const saveSched = () => {
    const [lh, lm] = localTime.split(':').map((x) => parseInt(x, 10) || 0);
    const [oh, om] = offsiteTime.split(':').map((x) => parseInt(x, 10) || 0);
    act('sched', () => saveScheduleRetention({ localH: lh ?? 2, localM: lm ?? 30, offsiteH: oh ?? 3, offsiteM: om ?? 30, retentionDays: parseInt(retention, 10) || 14 }), L('تم حفظ المواعيد ومدة الاحتفاظ', 'Schedule & retention saved'));
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
            'نسخة يومية تلقائية للبيانات والصور على الخادم (٢:٣٠ صباحًا)، مع إمكانية نسخة إضافية على خادم خارجي.',
            'Automatic daily backup of the database + uploads on the server (02:30), with an optional copy to an off-site server.',
          )}
        </p>
      </div>

      {/* Status cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={L('آخر نسخة', 'Last backup')} value={summary.lastBackupAt ? fmtWhen(summary.lastBackupAt) : '—'} sub="UTC" />
        <Stat label={L('عدد النسخ', 'Backup files')} value={String(summary.fileCount)} sub={fmtBytes(summary.totalSize)} />
        <Stat label={L('المساحة المتاحة', 'Free disk')} value={summary.diskFree != null ? fmtBytes(summary.diskFree) : '—'} />
        <Stat
          label={L('النسخ الخارجي', 'Off-site')}
          value={offsite.enabled ? L('مُفعّل', 'On') : L('غير مُفعّل', 'Off')}
          sub={offsite.enabled ? offsite.host : ''}
          tone={offsite.enabled ? 'good' : 'muted'}
        />
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
          {offsite.enabled && (
            <button className={btnSec} disabled={pending} onClick={() => act('push', runOffsitePush, L('تم الدفع للخادم الخارجي', 'Pushed off-site'))}>
              {busy === 'push' ? L('جارٍ الدفع…', 'Pushing…') : L('دفع للخادم الخارجي الآن', 'Push off-site now')}
            </button>
          )}
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

      {/* Off-site config */}
      <section className="space-y-4 rounded-lg border border-graphite/15 p-5">
        <div>
          <h2 className="font-semibold text-primary">{L('نسخة على خادم خارجي', 'Off-site backup server')}</h2>
          <p className="mt-1 text-sm opacity-70">
            {L(
              'يرسل نسخة يومية إلى خادمك الخاص (٣:٣٠ صباحًا) لتبقى نسخة حتى لو تعطّل الخادم الرئيسي.',
              'Sends a daily copy to your own server (03:30) so a backup survives even if this server is lost.',
            )}
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4" />
          {L('تفعيل النسخ الخارجي التلقائي', 'Enable automatic off-site backup')}
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={L('عنوان الخادم (Host/IP)', 'Server host / IP')}>
            <input dir="ltr" value={host} onChange={(e) => setHost(e.target.value)} placeholder="backup.example.com" className={inp} />
          </Field>
          <Field label={L('اسم المستخدم (SSH user)', 'SSH user')}>
            <input dir="ltr" value={user} onChange={(e) => setUser(e.target.value)} placeholder="nocbackup" className={inp} />
          </Field>
          <Field label={L('المنفذ (Port)', 'Port')}>
            <input dir="ltr" value={port} onChange={(e) => setPort(e.target.value)} placeholder="22" className={inp} />
          </Field>
          <Field label={L('المجلد على الخادم', 'Destination folder')}>
            <input dir="ltr" value={destPath} onChange={(e) => setDestPath(e.target.value)} placeholder="/home/nocbackup/noc" className={inp} />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} className="h-4 w-4" />
          {L('مطابقة النسخ (يحتفظ بآخر ١٤ يومًا فقط على الخادم الخارجي)', 'Mirror mode (keep only the last 14 days on the off-site server)')}
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button className={btn} disabled={pending} onClick={save}>
            {busy === 'save' ? L('جارٍ الحفظ…', 'Saving…') : L('حفظ', 'Save')}
          </button>
          <button className={btnSec} disabled={pending || !enabled} onClick={() => act('test', testOffsite, L('نجح الاتصال بالخادم الخارجي', 'Connected to the off-site server'))}>
            {busy === 'test' ? L('جارٍ الاختبار…', 'Testing…') : L('اختبار الاتصال', 'Test connection')}
          </button>
        </div>

        {/* Public key to authorize on the remote */}
        {pubkey && (
          <div className="space-y-2 rounded-md bg-graphite/5 p-3">
            <p className="text-sm font-semibold">{L('خطوة لمرة واحدة على خادمك الخارجي:', 'One-time step on your backup server:')}</p>
            <p className="text-xs opacity-70">
              {L(
                'أضف هذا السطر إلى ملف authorized_keys الخاص بالمستخدم على خادمك حتى يُسمح لهذا الخادم بالدخول:',
                "Add this line to the SSH user's authorized_keys on your server so this server is allowed to log in:",
              )}
            </p>
            <code className="block overflow-x-auto whitespace-pre rounded bg-navy-900/90 p-2 text-xs text-soft" dir="ltr">{pubkey}</code>
            <button
              className="text-xs font-bold text-accent hover:underline"
              onClick={() => navigator.clipboard?.writeText(pubkey).then(() => setMsg({ ok: true, text: L('تم نسخ المفتاح', 'Key copied') }))}
            >
              {L('نسخ المفتاح', 'Copy key')}
            </button>
          </div>
        )}
      </section>

      {/* Schedule + retention */}
      <section className="space-y-4 rounded-lg border border-graphite/15 p-5">
        <h2 className="font-semibold text-primary">{L('المواعيد ومدة الاحتفاظ', 'Schedule & retention')}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={L('موعد النسخة اليومية', 'Daily backup time')}>
            <input type="time" dir="ltr" value={localTime} onChange={(e) => setLocalTime(e.target.value)} className={inp} />
          </Field>
          <Field label={L('موعد النسخ الخارجي', 'Off-site push time')}>
            <input type="time" dir="ltr" value={offsiteTime} onChange={(e) => setOffsiteTime(e.target.value)} className={inp} />
          </Field>
          <Field label={L('مدة الاحتفاظ (بالأيام)', 'Keep backups for (days)')}>
            <input type="number" dir="ltr" min={1} max={365} value={retention} onChange={(e) => setRetention(e.target.value)} className={inp} />
          </Field>
        </div>
        <p className="text-xs opacity-60">{L('يُفضّل أن يكون موعد النسخ الخارجي بعد النسخة اليومية.', 'Tip: set the off-site time a little after the daily backup.')}</p>
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
          <Field label={L('بريد التنبيه', 'Alert email')}>
            <input dir="ltr" type="email" value={alertEmail} onChange={(e) => setAlertEmail(e.target.value)} placeholder="you@example.com" className={inp} />
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
