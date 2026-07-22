'use client';

import { useState, useTransition } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from '@noc/ui';
import { isValidPhone } from '@noc/config';
import { upsertOwner, deleteOwner } from '../actions';
import { OwnerFields, OWNER_EMPTY, pad, type OwnerDraft, type OwnerType } from './OwnerFields';

type Owner = { id: string; name: string; type: OwnerType; codes: number[]; phone1: string | null; phone1Whatsapp: boolean; phone2: string | null; phone2Whatsapp: boolean; details: string | null };

export function OwnersManager({ initial, takenCodes }: { initial: Owner[]; takenCodes: number[] }) {
  const locale = useLocale() as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const t = useTranslations('mp');
  const tc = useTranslations('common');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<OwnerDraft | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');

  const taken = new Set(takenCodes);
  const needle = q.trim().toLowerCase();
  const shown = needle
    ? initial.filter((o) =>
        `${o.name} ${o.phone1 ?? ''} ${o.phone2 ?? ''} ${o.codes.map(pad).join(' ')}`.toLowerCase().includes(needle),
      )
    : initial;

  function save() {
    if (!draft || !draft.name.trim()) { setError('failed'); return; }
    if (draft.phone1.trim() && !isValidPhone(draft.phone1)) { setError('invalid_phone'); return; }
    if (draft.phone2.trim() && !isValidPhone(draft.phone2)) { setError('invalid_phone'); return; }
    setError('');
    start(async () => {
      const r = await upsertOwner({ ...draft, codes: draft.type === 'PERSONAL' ? [] : draft.codes });
      if (r.ok) { setDraft(null); router.refresh(); toast(t('savedOk')); }
      else setError(r.error);
    });
  }
  function del(id: string) {
    if (!window.confirm(L('حذف نهائيًا؟', 'Delete permanently?'))) return;
    start(async () => {
      const r = await deleteOwner(id);
      if (r.ok) { router.refresh(); toast(t('deleted')); }
      else setError(r.error);
    });
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600">{error === 'owner_code_taken' ? t('ownerCodeTaken') : error === 'owner_code_range' ? t('ownerCodesHint') : error === 'invalid_phone' ? tc('phoneInvalid') : L('تعذّر الحفظ', 'Save failed')}</p>}

      {draft ? (
        <div className="space-y-3 rounded-lg border border-graphite/15 p-4">
          <OwnerFields draft={draft} setDraft={(d) => setDraft(d)} taken={taken} />
          <div className="flex gap-2">
            <button disabled={pending} onClick={save} className="rounded-md bg-primary px-4 py-2 text-sm text-soft disabled:opacity-50">{t('save')}</button>
            <button onClick={() => setDraft(null)} className="px-4 py-2 text-sm opacity-70">{t('cancel')}</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setDraft({ ...OWNER_EMPTY })} className="rounded-md bg-primary px-3 py-1.5 text-sm text-soft">+ {t('add')}</button>
      )}

      <div className="flex items-center justify-between gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('ownerSearch')} className="w-full max-w-xs rounded-md border border-graphite/20 bg-transparent px-3 py-1.5 text-sm" />
        <span className="whitespace-nowrap text-xs opacity-60">{shown.length}/{initial.length}</span>
      </div>

      <div className="space-y-2">
        {shown.map((o) => (
          <div key={o.id} className="flex items-center justify-between gap-3 rounded-lg border border-graphite/15 p-3">
            <div>
              <a href={`/admin/marketplace/owners/${o.id}`} className="font-semibold text-accent hover:underline">{o.name}</a>{' '}
              <span className="rounded bg-graphite/10 px-2 py-0.5 text-xs">{t(`type${o.type}`)}</span>
              {o.codes.length > 0 && <span className="ms-1 rounded bg-gold/20 px-2 py-0.5 text-xs font-num" dir="ltr">{o.codes.map(pad).join(' ')}</span>}
              <div className="text-xs opacity-70" dir="ltr">
                {[o.phone1 && `${o.phone1}${o.phone1Whatsapp ? ' (WA)' : ''}`, o.phone2 && `${o.phone2}${o.phone2Whatsapp ? ' (WA)' : ''}`].filter(Boolean).join('  ·  ')}
              </div>
              {o.details && <div className="text-xs opacity-60">{o.details}</div>}
            </div>
            <div className="flex gap-3 text-sm">
              {/* Editing an existing owner happens on its detail page (merged there). */}
              <a href={`/admin/marketplace/owners/${o.id}`} className="text-accent">{t('edit')}</a>
              <button disabled={pending} onClick={() => del(o.id)} className="text-red-600">{t('delete')}</button>
            </div>
          </div>
        ))}
        {shown.length === 0 && <p className="text-sm opacity-50">{t('none')}</p>}
      </div>
    </div>
  );
}
