'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from '@noc/ui';
import { approveListing, rejectListing } from '../actions';

export function ModerationActions({ id, incomplete = false }: { id: string; incomplete?: boolean }) {
  const locale = useLocale() as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const t = useTranslations('mp');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonMissing, setReasonMissing] = useState(false);
  const reasonRef = useRef<HTMLInputElement>(null);

  function approve() {
    start(async () => {
      const r = await approveListing(id);
      if (!r.ok) {
        // Name the missing details rather than a generic failure — the fix is a specific edit,
        // and the admin has no other way to know which required field is empty.
        toast(
          r.error === 'missing_required' && r.missing?.length
            ? L(`لا يمكن النشر — بيانات مطلوبة ناقصة: ${r.missing.join('، ')}`, `Cannot publish — required details are missing: ${r.missing.join(', ')}`)
            : L('تعذّر الحفظ', 'Save failed'),
          'error',
        );
        return;
      }
      router.refresh();
    });
  }

  function reject() {
    // A rejection must carry a reason the partner/seller can act on.
    if (!reason.trim()) {
      setReasonMissing(true);
      reasonRef.current?.focus();
      return;
    }
    setReasonMissing(false);
    start(async () => {
      const r = await rejectListing(id, reason);
      if (!r.ok) { toast(L('تعذّر الحفظ', 'Save failed'), 'error'); return; }
      router.refresh();
    });
  }

  return rejecting ? (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <div>
        <input
          ref={reasonRef}
          value={reason}
          onChange={(e) => { setReason(e.target.value); if (e.target.value.trim()) setReasonMissing(false); }}
          placeholder={t('rejectionReason')}
          className={`rounded border bg-transparent px-2 py-1 text-sm ${reasonMissing ? 'border-red-600' : 'border-graphite/20'}`}
        />
        {reasonMissing && <p className="mt-0.5 text-xs text-red-600">{L('سبب الرفض مطلوب', 'A rejection reason is required')}</p>}
      </div>
      <button disabled={pending} onClick={reject} className="rounded bg-red-600 px-2 py-1 text-sm text-white">{t('reject')}</button>
      <button onClick={() => { setRejecting(false); setReasonMissing(false); }} className="text-sm opacity-60">{t('cancel')}</button>
    </div>
  ) : (
    <div className="flex justify-end gap-2">
      {/* Disabled when required details are missing — the server refuses anyway, so offering a
          button that can only fail wastes a click and teaches nothing. The row above names them. */}
      <button
        disabled={pending || incomplete}
        onClick={approve}
        title={incomplete ? L('أكمل البيانات المطلوبة أولاً', 'Complete the required details first') : undefined}
        className="rounded bg-primary px-3 py-1 text-sm text-soft disabled:opacity-40"
      >
        {t('approve')}
      </button>
      <button onClick={() => setRejecting(true)} className="rounded border border-red-600 px-3 py-1 text-sm text-red-600">{t('reject')}</button>
    </div>
  );
}
