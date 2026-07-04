'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setReportStatus, deleteReport } from './actions';

export function ReportRowActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>) => start(async () => { await fn(); router.refresh(); });

  return (
    <div className="flex items-center justify-end gap-2">
      {status === 'NEW' ? (
        <button disabled={pending} onClick={() => run(() => setReportStatus(id, 'DONE'))} className="rounded-md bg-green px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">تمت المعالجة ✓</button>
      ) : (
        <button disabled={pending} onClick={() => run(() => setReportStatus(id, 'NEW'))} className="rounded-md border border-graphite/25 px-3 py-1.5 text-xs disabled:opacity-50">إعادة فتح</button>
      )}
      <button
        disabled={pending}
        onClick={() => { if (confirm('حذف هذا البلاغ نهائيًا؟')) run(() => deleteReport(id)); }}
        className="rounded-md border border-red-300 px-3 py-1.5 text-xs text-red-600 disabled:opacity-50"
      >
        حذف
      </button>
    </div>
  );
}
