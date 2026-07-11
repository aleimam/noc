'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from '@noc/ui';
import { isValidPhone } from '@noc/config';
import { upsertOwner, deleteOwner } from '../../actions';
import { OwnerFields, type OwnerDraft } from '../OwnerFields';

/** Single-owner editor on the owner detail page (name / type / phones / ad-codes / details).
 *  Merged here from the owners list so one page manages everything about an owner. */
export function OwnerEditor({ initial, takenCodes }: { initial: OwnerDraft; takenCodes: number[] }) {
  const t = useTranslations('mp');
  const tc = useTranslations('common');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<OwnerDraft>(initial);
  const [error, setError] = useState('');
  const taken = new Set(takenCodes);

  function save() {
    if (!draft.name.trim()) { setError('failed'); return; }
    if (draft.phone1.trim() && !isValidPhone(draft.phone1)) { setError('invalid_phone'); return; }
    if (draft.phone2.trim() && !isValidPhone(draft.phone2)) { setError('invalid_phone'); return; }
    setError('');
    start(async () => {
      const r = await upsertOwner({ ...draft, codes: draft.type === 'PERSONAL' ? [] : draft.codes });
      if (r.ok) { router.refresh(); toast(t('savedOk')); }
      else setError(r.error);
    });
  }
  function del() {
    if (!draft.id) return;
    if (!window.confirm('حذف نهائيًا؟ / Delete permanently?')) return;
    start(async () => {
      const r = await deleteOwner(draft.id!);
      if (r.ok) { toast(t('deleted')); router.push('/admin/marketplace/owners'); }
      else setError(r.error);
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-graphite/15 p-4">
      {error && (
        <p className="text-sm text-red-600">
          {error === 'owner_code_taken' ? t('ownerCodeTaken') : error === 'owner_code_range' ? t('ownerCodesHint') : error === 'invalid_phone' ? tc('phoneInvalid') : 'تعذّر الحفظ / Save failed'}
        </p>
      )}
      <OwnerFields draft={draft} setDraft={setDraft} taken={taken} />
      <div className="flex flex-wrap gap-2">
        <button disabled={pending} onClick={save} className="rounded-md bg-primary px-4 py-2 text-sm text-soft disabled:opacity-50">{t('save')}</button>
        <button disabled={pending} onClick={del} className="rounded-md border border-red-300 px-4 py-2 text-sm text-red-600 disabled:opacity-50">{t('delete')}</button>
      </div>
    </div>
  );
}
