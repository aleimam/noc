'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { registerInquiry } from './actions';

export type ResultRow = {
  id: string;
  numberInSheet: string | null;
  ownerName: string;
  company: string | null;
  originalPiece: string | null;
  originalLocation: string | null;
  originalMember: string | null;
  sheetDateLabel: string;
};

const inp = 'w-full rounded-md border border-graphite/20 bg-transparent px-3 py-2 text-sm';

export function FoundResults({ rows }: { rows: ResultRow[] }) {
  const t = useTranslations('rationing');
  const tc = useTranslations('common');
  const [sel, setSel] = useState<ResultRow | null>(null);
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [doneId, setDoneId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  return (
    <>
      <p className="text-sm opacity-70">{t('resultsN', { n: rows.length })}</p>
      <div className="overflow-x-auto rounded-lg border border-graphite/15">
        <table className="w-full whitespace-nowrap text-sm">
          <thead>
            <tr className="opacity-60">
              <th className="p-2 text-start">{t('colNumber')}</th>
              <th className="p-2 text-start">{t('colOwner')}</th>
              <th className="p-2 text-start">{t('colCompany')}</th>
              <th className="p-2 text-start">{t('colPiece')}</th>
              <th className="p-2 text-start">{t('colLocation')}</th>
              <th className="p-2 text-start">{t('colMember')}</th>
              <th className="p-2 text-start">{t('colSheetDate')}</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-graphite/10">
                <td className="p-2">{r.numberInSheet ?? '—'}</td>
                <td className="p-2 font-medium">{r.ownerName}</td>
                <td className="p-2">{r.company ?? '—'}</td>
                <td className="p-2">{r.originalPiece ?? '—'}</td>
                <td className="p-2">{r.originalLocation ?? '—'}</td>
                <td className="p-2">{r.originalMember ?? '—'}</td>
                <td className="p-2" dir="ltr">{r.sheetDateLabel}</td>
                <td className="p-2 text-end">
                  {doneId === r.id ? (
                    <span className="text-xs text-green">{t('registered')}</span>
                  ) : (
                    <button onClick={() => { setSel(r); setError(''); }} className="text-xs font-medium text-green">
                      {t('registerFollow')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sel && doneId !== sel.id && (
        <div className="rounded-lg border border-green/40 bg-green/5 p-4">
          <p className="font-medium text-primary">{t('foundCta')}</p>
          <p className="mb-3 mt-1 text-sm opacity-80">
            {sel.ownerName}
            {sel.originalPiece ? ` · ${t('colPiece')} ${sel.originalPiece}` : ''}
            {sel.originalLocation ? ` · ${sel.originalLocation}` : ''}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!phone.trim()) return;
              setError('');
              start(async () => {
                const res = await registerInquiry({
                  kind: 'FOUND_FOLLOW',
                  matchedSheetId: sel.id,
                  ownerName: sel.ownerName,
                  company: sel.company ?? undefined,
                  originalPiece: sel.originalPiece ?? undefined,
                  originalLocation: sel.originalLocation ?? undefined,
                  originalMember: sel.originalMember ?? undefined,
                  phone,
                  note,
                });
                if (res.ok) {
                  setDoneId(sel.id);
                  setSel(null);
                  setPhone('');
                  setNote('');
                } else {
                  setError(t('registerError'));
                }
              });
            }}
            className="flex flex-wrap items-end gap-3"
          >
            <label className="text-sm">{t('yourPhone')}<input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" className={inp} required /></label>
            <label className="flex-1 text-sm">{t('note')}<input value={note} onChange={(e) => setNote(e.target.value)} className={inp} /></label>
            <button disabled={pending} className="rounded-md bg-primary px-5 py-2 text-sm text-soft disabled:opacity-50">
              {pending ? t('submitting') : t('submit')}
            </button>
            <button type="button" onClick={() => setSel(null)} className="px-3 py-2 text-sm opacity-70">{tc('cancel')}</button>
            {error && <span className="text-sm text-red-600">{error}</span>}
          </form>
        </div>
      )}
    </>
  );
}
