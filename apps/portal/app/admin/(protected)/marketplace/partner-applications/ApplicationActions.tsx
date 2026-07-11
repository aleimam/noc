'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@noc/ui';
import { runAction } from '@/app/admin/(protected)/runAction';
import { setApplicationStatus, deleteApplication } from './actions';

type Status = 'PENDING' | 'REVIEWING' | 'APPROVED' | 'REJECTED';

/** Per-application review controls: a note, status buttons, and delete. */
export function ApplicationActions({ id, status, note, locale }: { id: string; status: Status; note: string | null; locale: 'ar' | 'en' }) {
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [n, setN] = useState(note ?? '');

  const setStatus = (s: Status) =>
    start(async () => {
      const r = await setApplicationStatus(id, s, n);
      if (r.ok) { router.refresh(); toast(L('تم الحفظ', 'Saved')); }
    });
  const del = () =>
    start(async () => {
      const ok = await runAction(() => deleteApplication(id), {
        confirmText: L('حذف نهائيًا؟', 'Delete permanently?'),
        successText: L('تم الحذف', 'Deleted'),
        errorText: L('تعذّر الحذف', 'Delete failed'),
      });
      if (ok) router.refresh();
    });

  const btn = (s: Status, label: string, cls: string) => (
    <button type="button" disabled={pending} onClick={() => setStatus(s)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50 ${status === s ? cls : 'border border-graphite/25'}`}>
      {label}
    </button>
  );

  return (
    <div className="mt-3 space-y-2 border-t border-graphite/10 pt-3">
      <textarea value={n} onChange={(e) => setN(e.target.value)} rows={2} placeholder={L('ملاحظة المراجعة (اختياري)', 'Review note (optional)')} className="w-full rounded-md border border-graphite/20 bg-transparent px-3 py-2 text-sm" />
      <div className="flex flex-wrap items-center gap-2">
        {btn('REVIEWING', L('قيد المراجعة', 'Reviewing'), 'bg-gold/20 text-gold-800')}
        {btn('APPROVED', L('مقبول', 'Approved'), 'bg-green/15 text-green')}
        {btn('REJECTED', L('مرفوض', 'Rejected'), 'bg-red-100 text-red-700')}
        <a href="/admin/marketplace/owners" className="rounded-lg border border-graphite/25 px-3 py-1.5 text-sm font-semibold text-accent">{L('إنشاء مالك + حساب ←', 'Create owner + account ←')}</a>
        <button type="button" disabled={pending} onClick={del} className="ms-auto text-sm text-red-600 disabled:opacity-50">{L('حذف', 'Delete')}</button>
      </div>
    </div>
  );
}
