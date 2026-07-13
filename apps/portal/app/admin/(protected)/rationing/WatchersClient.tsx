'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { setFollowStatus, deleteFollow, recheckWatchers, sendCongratsSms, markContacted, unmarkContacted } from './actions';

export function WatcherActions({ id, status }: { id: string; status: string }) {
  const t = useTranslations('rationing');
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      router.refresh();
    });
  return (
    <div className="flex items-center justify-end gap-3">
      {status === 'active' ? (
        <button disabled={pending} onClick={() => run(() => setFollowStatus(id, 'closed'))} className="text-xs opacity-70 disabled:opacity-50">
          {t('closeFollow')}
        </button>
      ) : (
        <button disabled={pending} onClick={() => run(() => setFollowStatus(id, 'active'))} className="text-xs text-accent disabled:opacity-50">
          {t('reactivateFollow')}
        </button>
      )}
      <button
        disabled={pending}
        onClick={() => {
          if (!confirm(t('confirmDeleteFollow'))) return;
          run(() => deleteFollow(id));
        }}
        className="text-xs text-red-600 disabled:opacity-50"
      >
        {t('deleteFollow')}
      </button>
    </div>
  );
}

export function RecheckWatchersButton() {
  const t = useTranslations('rationing');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            setMsg(null);
            const r = await recheckWatchers();
            if (r.ok) setMsg({ ok: true, text: t('recheckDone', { matched: r.matched }) });
            else setMsg({ ok: false, text: t('err_failed') });
            router.refresh();
          })
        }
        className="rounded-md border border-accent px-3 py-2 text-sm font-semibold text-accent hover:bg-accent/5 disabled:opacity-50"
      >
        {pending ? t('rechecking') : t('recheckExisting')}
      </button>
      {msg && <span className={msg.ok ? 'text-sm text-green' : 'text-sm text-red-600'}>{msg.text}</span>}
    </div>
  );
}

export type FollowRow = {
  id: string;
  name: string;
  plot: string;
  block: string;
  city: string;
  phone: string | null;
  sheetId: string | null;
  sheetLabel: string | null;
  autoSms: string | null;
  congrats: string | null;
  contacted: string | null;
  contactedBy: string | null;
};

/** The matched-follow-up workspace: pick names → send congratulations SMS + mark
 *  contacted-by-phone. In `contacted` mode it's the read-only Done list with an undo. */
export function FollowupTable({ rows, mode, locale }: { rows: FollowRow[]; mode: 'followup' | 'contacted'; locale: 'ar' | 'en' }) {
  const t = useTranslations('rationing');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const dash = '—';

  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected = rows.length > 0 && rows.every((r) => sel.has(r.id));
  const toggleAll = () => setSel(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  const ids = [...sel];

  const doCongrats = () =>
    start(async () => {
      setMsg(null);
      const r = await sendCongratsSms(ids);
      if (r.ok) { setMsg({ ok: true, text: t('congratsSentToast', { sent: r.sent, skipped: r.skipped }) }); setSel(new Set()); }
      else setMsg({ ok: false, text: t('err_failed') });
      router.refresh();
    });
  const doContacted = (list: string[]) =>
    start(async () => {
      setMsg(null);
      const r = await markContacted(list);
      if (r.ok) { setMsg({ ok: true, text: t('contactedToast', { n: r.n }) }); setSel(new Set()); }
      else setMsg({ ok: false, text: t('err_failed') });
      router.refresh();
    });
  const doUndo = (id: string) => start(async () => { await unmarkContacted(id); router.refresh(); });

  if (rows.length === 0) return <p className="py-12 text-center opacity-60">{mode === 'followup' ? t('noFollowup') : t('noContacted')}</p>;

  return (
    <div className="space-y-3">
      {mode === 'followup' && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-graphite/15 bg-paper p-3">
          <span className="text-sm font-semibold">{t('selectedN', { n: sel.size })}</span>
          <button disabled={pending || sel.size === 0} onClick={doCongrats} className="rounded-md bg-green px-3 py-2 text-sm text-soft disabled:opacity-40">
            {t('sendCongrats')}
          </button>
          <button disabled={pending || sel.size === 0} onClick={() => doContacted(ids)} className="rounded-md bg-primary px-3 py-2 text-sm text-soft disabled:opacity-40">
            {t('markContactedBtn')}
          </button>
          {msg && <span className={msg.ok ? 'text-sm text-green' : 'text-sm text-red-600'}>{msg.text}</span>}
        </div>
      )}
      {mode === 'contacted' && msg && <span className={msg.ok ? 'text-sm text-green' : 'text-sm text-red-600'}>{msg.text}</span>}

      <div className="overflow-x-auto rounded-lg border border-graphite/15">
        <table className="w-full whitespace-nowrap text-sm">
          <thead>
            <tr className="opacity-60">
              {mode === 'followup' && (
                <th className="p-2"><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label={t('selectAll')} className="h-4 w-4 align-middle" /></th>
              )}
              <th className="p-2 text-start">{t('colApplicant')}</th>
              <th className="p-2 text-start">{t('colPlot')}</th>
              <th className="p-2 text-start">{t('colBlock')}</th>
              <th className="p-2 text-start">{t('colCity')}</th>
              <th className="p-2 text-start">{t('phone')}</th>
              <th className="p-2 text-start">{t('matchedSheet')}</th>
              {mode === 'followup' ? (
                <>
                  <th className="p-2 text-start">{t('autoSmsCol')}</th>
                  <th className="p-2 text-start">{t('congratsCol')}</th>
                </>
              ) : (
                <>
                  <th className="p-2 text-start">{t('congratsCol')}</th>
                  <th className="p-2 text-start">{t('contactedAtCol')}</th>
                  <th className="p-2 text-start">{t('contactedByCol')}</th>
                </>
              )}
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={`border-t border-graphite/10 ${mode === 'followup' && sel.has(r.id) ? 'bg-accent/5' : ''}`}>
                {mode === 'followup' && (
                  <td className="p-2 text-center"><input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} className="h-4 w-4 align-middle" /></td>
                )}
                <td className="p-2 font-medium">{r.name}</td>
                <td className="p-2">{r.plot || dash}</td>
                <td className="p-2">{r.block || dash}</td>
                <td className="p-2">{r.city || dash}</td>
                <td className="p-2" dir="ltr">{r.phone ?? <span className="opacity-50">{t('noPhone')}</span>}</td>
                <td className="p-2">
                  {r.sheetId ? (
                    <a href={`/rationing/${r.sheetId}`} target="_blank" rel="noreferrer" className="text-accent hover:underline">{r.sheetLabel}</a>
                  ) : dash}
                </td>
                {mode === 'followup' ? (
                  <>
                    <td className="p-2" dir="ltr">{r.autoSms ? <span className="text-green">✓ {r.autoSms}</span> : dash}</td>
                    <td className="p-2" dir="ltr">{r.congrats ? <span className="text-green">✓ {r.congrats}</span> : dash}</td>
                    <td className="p-2 text-end">
                      <button disabled={pending} onClick={() => doContacted([r.id])} className="text-xs text-accent disabled:opacity-50">{t('markContactedOne')}</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="p-2" dir="ltr">{r.congrats ? <span className="text-green">✓ {r.congrats}</span> : dash}</td>
                    <td className="p-2" dir="ltr">{r.contacted}</td>
                    <td className="p-2" dir="ltr">{r.contactedBy || dash}</td>
                    <td className="p-2 text-end">
                      <button disabled={pending} onClick={() => doUndo(r.id)} className="text-xs opacity-70 disabled:opacity-50">{t('undo')}</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
