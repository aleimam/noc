'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast, PasswordInput } from '@noc/ui';
import { runAllNow, runTierNow, saveOffsiteConnection, saveTiers, testOffsiteConnection, type TierInput } from './offsite-actions';

export type ConnView = {
  enabled: boolean;
  host: string;
  port: number;
  username: string;
  hasPassword: boolean;
  remotePath: string;
  notifyOnFailure: boolean;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
  lastTestMessage: string | null;
};
export type TierView = TierInput & { label: string; lastRunAt: string | null };
export type RunView = { id: string; tierKey: string | null; startedAt: string; status: string; trigger: string; contents: string; fileName: string | null; sizeMb: string | null; error: string | null };

const inp = 'w-full rounded-md border border-graphite/20 bg-transparent px-3 py-2 text-sm';
const FREQS = ['OFF', 'HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY'];

/**
 * The TIERED off-site backup panel (Hetzner Storage Box over SFTP). Sits alongside the
 * existing local-backup + rsync sections — it does not replace them.
 */
export function OffsiteTiers({ locale, conn, tiers: initialTiers, runs }: { locale: 'ar' | 'en'; conn: ConnView; tiers: TierView[]; runs: RunView[] }) {
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [c, setC] = useState({ ...conn, password: '' });
  const [tiers, setTiers] = useState(initialTiers);

  const patchTier = (key: string, p: Partial<TierView>) =>
    setTiers((prev) => prev.map((t) => (t.key === key ? { ...t, ...p } : t)));

  const act = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>, okMsg: string) =>
    start(async () => {
      const r = await fn();
      if (r.ok) { toast(r.message ? `${okMsg} — ${r.message}` : okMsg); router.refresh(); }
      else toast(r.error ?? L('فشلت العملية', 'Failed'), 'error');
    });

  return (
    <section className="space-y-4 rounded-lg border-2 border-navy-800/20 p-4">
      <div>
        <h2 className="text-lg font-black text-navy-800">🗄️ {L('نسخ احتياطي خارجي بمستويات', 'Tiered off-site backup')}</h2>
        <p className="mt-1 text-xs leading-relaxed opacity-70">
          {L(
            'يرفع نسخة من قاعدة البيانات (والملفات) إلى خادم تخزين خارجي عبر SFTP، بمستويات مستقلة لكل منها جدوله ومجلده وعدد النسخ المحفوظة. هذا إضافة للنسخ المحلية اليومية — لا يستبدلها.',
            'Pushes the database (and files) to a remote storage box over SFTP, in independent levels each with its own schedule, folder and retention. This is IN ADDITION to the local nightly backups — it does not replace them.',
          )}
        </p>
      </div>

      {/* ── connection ── */}
      <div className="space-y-3 rounded-lg border border-graphite/15 p-3">
        <h3 className="font-semibold text-primary">{L('بيانات الاتصال', 'Connection')}</h3>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={c.enabled} onChange={(e) => setC({ ...c, enabled: e.target.checked })} />
          {L('تفعيل الجدولة التلقائية', 'Enable scheduled runs')}
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">{L('الخادم', 'Host')}
            <input dir="ltr" value={c.host} onChange={(e) => setC({ ...c, host: e.target.value })} placeholder="u635384.your-storagebox.de" className={inp} />
          </label>
          <label className="text-sm">{L('المنفذ', 'Port')}
            <input dir="ltr" inputMode="numeric" value={c.port} onChange={(e) => setC({ ...c, port: Number(e.target.value) || 0 })} className={inp} />
            <span className="mt-1 block text-xs opacity-60">{L('صندوق Hetzner يستخدم 23 وليس 22.', 'Hetzner Storage Box uses 23, not 22.')}</span>
          </label>
          <label className="text-sm">{L('اسم المستخدم', 'Username')}
            <input dir="ltr" value={c.username} onChange={(e) => setC({ ...c, username: e.target.value })} className={inp} />
          </label>
          <label className="text-sm">{L('كلمة المرور', 'Password')}
            <PasswordInput value={c.password} onChange={(v) => setC({ ...c, password: v })} locale={locale} className={inp}
              placeholder={c.hasPassword ? L('محفوظة — اتركها فارغة للإبقاء عليها', 'Stored — leave empty to keep it') : L('أدخل كلمة المرور', 'Enter the password')} />
          </label>
          <label className="text-sm sm:col-span-2">{L('المجلد الأساسي', 'Base folder')}
            <input dir="ltr" value={c.remotePath} onChange={(e) => setC({ ...c, remotePath: e.target.value })} className={inp} />
            <span className="mt-1 block text-xs opacity-60">
              {L('الحساب الفرعي يرى مجلده الأساسي باسم /home — وليس / ولا /noc.', 'A sub-account sees its base directory as /home — not / and not /noc.')}
            </span>
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={c.notifyOnFailure} onChange={(e) => setC({ ...c, notifyOnFailure: e.target.checked })} />
          {L('تنبيهي عند الفشل', 'Notify me on failure')}
        </label>
        <div className="flex flex-wrap gap-2">
          <button disabled={pending} onClick={() => act(() => saveOffsiteConnection(c), L('تم الحفظ', 'Saved'))}
            className="min-h-[40px] rounded-md bg-primary px-4 py-2 text-sm font-bold text-soft disabled:opacity-50">
            {L('حفظ الاتصال', 'Save connection')}
          </button>
          <button disabled={pending} onClick={() => act(testOffsiteConnection, L('نجح الاتصال', 'Connected'))}
            className="min-h-[40px] rounded-md border border-graphite/25 px-4 py-2 text-sm disabled:opacity-50">
            🔌 {L('اختبار الاتصال', 'Test connection')}
          </button>
        </div>
        {conn.lastTestAt && (
          <p className={`text-xs ${conn.lastTestOk ? 'text-green' : 'text-red-600'}`}>
            {conn.lastTestOk ? '✓' : '✕'} {conn.lastTestMessage}
          </p>
        )}
      </div>

      {/* ── levels ── */}
      <div className="space-y-3 rounded-lg border border-graphite/15 p-3">
        <h3 className="font-semibold text-primary">{L('المستويات', 'Levels')}</h3>
        <p className="text-xs opacity-60">
          {L('لكل مستوى مجلد خاص به — لا تجعل مستويين يستخدمان نفس المجلد، لأن كل واحد سيحذف نسخ الآخر عند التنظيف.',
             'Each level needs its OWN folder — two levels sharing one would make each prune the other\'s archives.')}
        </p>
        <div className="space-y-3">
          {tiers.map((t) => (
            <div key={t.key} className="space-y-2 rounded-md border border-graphite/15 bg-paper p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-navy-800">{t.label || t.key}</span>
                <span className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs">
                    <input type="checkbox" checked={t.enabled} onChange={(e) => patchTier(t.key, { enabled: e.target.checked })} />
                    {L('مجدول', 'Scheduled')}
                  </label>
                  <button disabled={pending} onClick={() => act(() => runTierNow(t.key), `${t.label || t.key} ✓`)}
                    className="min-h-[36px] rounded-md border border-graphite/25 px-3 py-1 text-xs font-semibold disabled:opacity-50">
                    ▶ {L('شغّل الآن', 'Run now')}
                  </button>
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-4">
                <label className="text-xs">{L('التكرار', 'Frequency')}
                  <select value={t.frequency} onChange={(e) => patchTier(t.key, { frequency: e.target.value })} className={inp}>
                    {FREQS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </label>
                <label className="text-xs">{L('كل (N)', 'Every N')}
                  <input dir="ltr" inputMode="numeric" value={t.everyN} onChange={(e) => patchTier(t.key, { everyN: Number(e.target.value) || 1 })} className={inp} />
                </label>
                <label className="text-xs">{L('المحتوى', 'Contents')}
                  <select value={t.contents} onChange={(e) => patchTier(t.key, { contents: e.target.value })} className={inp}>
                    <option value="DB">{L('قاعدة البيانات فقط', 'Database only')}</option>
                    <option value="FULL">{L('كامل (مع الملفات)', 'Full (with uploads)')}</option>
                  </select>
                </label>
                <label className="text-xs">{L('عدد النسخ المحفوظة', 'Keep last')}
                  <input dir="ltr" inputMode="numeric" value={t.keepLast} onChange={(e) => patchTier(t.key, { keepLast: Number(e.target.value) })} className={inp} />
                </label>
                <label className="text-xs sm:col-span-2">{L('المجلد', 'Folder')}
                  <input dir="ltr" value={t.remotePath} onChange={(e) => patchTier(t.key, { remotePath: e.target.value })} className={inp} />
                </label>
                <label className="text-xs">{L('الساعة (UTC)', 'Hour (UTC)')}
                  <input dir="ltr" inputMode="numeric" value={t.hourUtc} onChange={(e) => patchTier(t.key, { hourUtc: Number(e.target.value) })} className={inp} />
                </label>
                <div className="text-xs opacity-60">
                  <span className="block">{L('آخر تشغيل', 'Last run')}</span>
                  <span dir="ltr">{t.lastRunAt ?? L('لم يُشغّل بعد', 'never')}</span>
                </div>
              </div>
              {t.frequency === 'OFF' && (
                <p className="text-xs text-amber-700">
                  {L('«OFF» يعني أنه لا يعمل تلقائيًا أبدًا — يعمل بالزر فقط، ويحتفظ بمجلده ونسخه الخاصة.',
                     '"OFF" means it never runs automatically — button-only, keeping its own folder and retention slots.')}
                </p>
              )}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button disabled={pending} onClick={() => act(() => saveTiers(tiers), L('تم حفظ المستويات', 'Levels saved'))}
            className="min-h-[40px] rounded-md bg-primary px-4 py-2 text-sm font-bold text-soft disabled:opacity-50">
            {L('حفظ المستويات', 'Save levels')}
          </button>
          <button disabled={pending} onClick={() => act(runAllNow, L('تم تشغيل كل المستويات', 'All levels ran'))}
            className="min-h-[40px] rounded-md border border-gold-400/60 bg-gold/10 px-4 py-2 text-sm font-bold text-gold-700 disabled:opacity-50">
            ⬆ {L('نسخة احتياطية الآن (كل المستويات)', 'Backup now (all levels)')}
          </button>
        </div>
      </div>

      {/* ── history ── */}
      <div className="space-y-2 rounded-lg border border-graphite/15 p-3">
        <h3 className="font-semibold text-primary">{L('آخر العمليات', 'Recent runs')}</h3>
        {runs.length === 0 ? (
          <p className="text-sm opacity-60">{L('لا توجد عمليات بعد.', 'No runs yet.')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="opacity-60">
                <tr>
                  <th className="p-1.5 text-start">{L('المستوى', 'Level')}</th>
                  <th className="p-1.5 text-start">{L('البداية', 'Started')}</th>
                  <th className="p-1.5 text-start">{L('الحالة', 'Status')}</th>
                  <th className="p-1.5 text-start">{L('المحتوى', 'Contents')}</th>
                  <th className="p-1.5 text-start">{L('الملف', 'File')}</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-t border-graphite/10">
                    <td className="p-1.5 font-semibold">{r.tierKey ?? '—'}</td>
                    <td className="p-1.5" dir="ltr">{r.startedAt}</td>
                    <td className="p-1.5">
                      <span className={r.status === 'SUCCESS' ? 'text-green' : r.status === 'FAILED' ? 'text-red-600' : 'opacity-70'}>
                        {r.status === 'SUCCESS' ? '✓' : r.status === 'FAILED' ? '✕' : '…'} {r.status}
                      </span>
                      {r.error && <span className="block max-w-md truncate opacity-70" title={r.error}>{r.error}</span>}
                    </td>
                    <td className="p-1.5" dir="ltr">{r.contents || '—'}</td>
                    <td className="p-1.5 font-mono" dir="ltr">{r.fileName ?? '—'}{r.sizeMb ? ` (${r.sizeMb} MB)` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
