'use client';

import { useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { importSheets, deleteBatch, setInquiryStatus } from './actions';

const ERR_KEY = {
  no_file: 'err_no_file',
  empty: 'err_empty',
  no_rows: 'err_no_rows',
  parse_failed: 'err_parse_failed',
  failed: 'err_failed',
} as const;

export function ImportSheets() {
  const t = useTranslations('rationing');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const file = ref.current?.files?.[0];
        if (!file) {
          setMsg({ ok: false, text: t('err_no_file') });
          return;
        }
        const fd = new FormData();
        fd.append('file', file);
        start(async () => {
          const r = await importSheets(fd);
          if (r.ok) {
            setMsg({ ok: true, text: t('importedN', { n: r.count ?? 0 }) });
            if (ref.current) ref.current.value = '';
            router.refresh();
          } else {
            setMsg({ ok: false, text: t(ERR_KEY[r.error as keyof typeof ERR_KEY] ?? 'err_failed') });
          }
        });
      }}
      className="flex flex-wrap items-center gap-3 rounded-lg border border-graphite/15 p-4"
    >
      <input ref={ref} type="file" accept=".xlsx,.xls" className="text-sm" />
      <button disabled={pending} className="rounded-md bg-primary px-4 py-2 text-sm text-soft disabled:opacity-50">
        {pending ? t('importing') : t('import')}
      </button>
      <a href="/admin/rationing/sheets/template" className="text-sm text-accent">{t('downloadTemplate')}</a>
      {msg && <span className={msg.ok ? 'text-sm text-green' : 'text-sm text-red-600'}>{msg.text}</span>}
    </form>
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
