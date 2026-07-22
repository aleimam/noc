'use client';

import { useTransition } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { setReportStatus, deleteReport } from './actions';

export function ReportRowActions({ id, status }: { id: string; status: string }) {
  const locale = useLocale() as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>) => start(async () => { await fn(); router.refresh(); });

  return (
    <div className="flex items-center justify-end gap-2">
      {status === 'NEW' ? (
        <button disabled={pending} onClick={() => run(() => setReportStatus(id, 'DONE'))} className="rounded-md bg-green px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">{L('تمت المعالجة ✓', 'Handled ✓')}</button>
      ) : (
        <button disabled={pending} onClick={() => run(() => setReportStatus(id, 'NEW'))} className="rounded-md border border-graphite/25 px-3 py-1.5 text-xs disabled:opacity-50">{L('إعادة فتح', 'Reopen')}</button>
      )}
      <button
        disabled={pending}
        onClick={() => { if (confirm(L('حذف هذا البلاغ نهائيًا؟', 'Delete this report permanently?'))) run(() => deleteReport(id)); }}
        className="rounded-md border border-red-300 px-3 py-1.5 text-xs text-red-600 disabled:opacity-50"
      >
        {L('حذف', 'Delete')}
      </button>
    </div>
  );
}
