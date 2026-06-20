'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { registerInquiry } from './actions';

type Fields = {
  ownerName: string;
  phone: string;
  company: string;
  originalPiece: string;
  originalLocation: string;
  originalMember: string;
  note: string;
};

const inp = 'w-full rounded-md border border-graphite/20 bg-transparent px-3 py-2 text-sm';

export function RegisterForm({
  kind,
  defaultOwnerName = '',
  matchedSheetId,
}: {
  kind: 'FOUND_FOLLOW' | 'NOT_FOUND_WATCH';
  defaultOwnerName?: string;
  matchedSheetId?: string;
}) {
  const t = useTranslations('rationing');
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [f, setF] = useState<Fields>({
    ownerName: defaultOwnerName,
    phone: '',
    company: '',
    originalPiece: '',
    originalLocation: '',
    originalMember: '',
    note: '',
  });
  const upd = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  if (done) return <p className="rounded-md bg-green/10 px-4 py-3 text-sm text-green">{t('registered')}</p>;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!f.phone.trim() || !f.ownerName.trim()) return;
        setError('');
        start(async () => {
          const r = await registerInquiry({ ...f, kind, matchedSheetId });
          if (r.ok) setDone(true);
          else setError(t('registerError'));
        });
      }}
      className="grid gap-3 sm:grid-cols-2"
    >
      <label className="text-sm">{t('colOwner')}<input value={f.ownerName} onChange={upd('ownerName')} className={inp} required /></label>
      <label className="text-sm">{t('yourPhone')}<input value={f.phone} onChange={upd('phone')} dir="ltr" className={inp} required /></label>
      <label className="text-sm">{t('colCompany')}<input value={f.company} onChange={upd('company')} className={inp} /></label>
      <label className="text-sm">{t('colPiece')}<input value={f.originalPiece} onChange={upd('originalPiece')} className={inp} /></label>
      <label className="text-sm">{t('colLocation')}<input value={f.originalLocation} onChange={upd('originalLocation')} className={inp} /></label>
      <label className="text-sm">{t('colMember')}<input value={f.originalMember} onChange={upd('originalMember')} className={inp} /></label>
      <label className="text-sm sm:col-span-2">{t('note')}<input value={f.note} onChange={upd('note')} className={inp} /></label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button disabled={pending} className="rounded-md bg-primary px-5 py-2 text-sm text-soft disabled:opacity-50">
          {pending ? t('submitting') : t('submit')}
        </button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </form>
  );
}
