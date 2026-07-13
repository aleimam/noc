'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { setFollowStatus, deleteFollow, recheckWatchers } from './actions';

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
