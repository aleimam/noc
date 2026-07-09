'use client';

import { useTranslations } from 'next-intl';

// Shared owner form fields (name / type / phones / ad-codes / details), used by both the
// owners LIST (add new) and the owner DETAIL page (edit existing) so there is one source
// of truth for the form.

export type OwnerType = 'PERSONAL' | 'COMPANY' | 'BROKER' | 'US';
export type OwnerDraft = {
  id?: string;
  name: string;
  type: OwnerType;
  codes: number[];
  phone1: string;
  phone1Whatsapp: boolean;
  phone2: string;
  phone2Whatsapp: boolean;
  details: string;
};

export const OWNER_EMPTY: OwnerDraft = { name: '', type: 'PERSONAL', codes: [], phone1: '', phone1Whatsapp: false, phone2: '', phone2Whatsapp: false, details: '' };
const TYPES: OwnerType[] = ['PERSONAL', 'COMPANY', 'BROKER', 'US'];
const inp = 'w-full rounded-md border border-graphite/20 bg-transparent px-3 py-2 text-sm';
export const pad = (n: number) => String(n).padStart(2, '0');

// Code pool for a type: Us 00–09, Company/Broker 10–79, Personal none.
export function poolFor(type: OwnerType): number[] {
  if (type === 'US') return Array.from({ length: 10 }, (_, i) => i); // 0–9
  if (type === 'COMPANY' || type === 'BROKER') return Array.from({ length: 70 }, (_, i) => i + 10); // 10–79
  return [];
}

export function OwnerFields({ draft, setDraft, taken }: { draft: OwnerDraft; setDraft: (d: OwnerDraft) => void; taken: Set<number> }) {
  const t = useTranslations('mp');
  const toggleCode = (code: number) => {
    const has = draft.codes.includes(code);
    setDraft({ ...draft, codes: has ? draft.codes.filter((c) => c !== code) : [...draft.codes, code].sort((a, b) => a - b) });
  };
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">{t('ownerName')}<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inp} /></label>
        <label className="text-sm">{t('ownerType')}
          <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as OwnerType, codes: [] })} className={inp}>
            {TYPES.map((x) => (<option key={x} value={x}>{t(`type${x}`)}</option>))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <label className="flex-1 text-sm">{t('phone1')}<input dir="ltr" value={draft.phone1} onChange={(e) => setDraft({ ...draft, phone1: e.target.value })} className={inp} /></label>
          <label className="flex items-center gap-1 pb-2 text-sm"><input type="checkbox" checked={draft.phone1Whatsapp} onChange={(e) => setDraft({ ...draft, phone1Whatsapp: e.target.checked })} />{t('hasWhatsapp')}</label>
        </div>
        <div className="flex items-end gap-2">
          <label className="flex-1 text-sm">{t('phone2')}<input dir="ltr" value={draft.phone2} onChange={(e) => setDraft({ ...draft, phone2: e.target.value })} className={inp} /></label>
          <label className="flex items-center gap-1 pb-2 text-sm"><input type="checkbox" checked={draft.phone2Whatsapp} onChange={(e) => setDraft({ ...draft, phone2Whatsapp: e.target.checked })} />{t('hasWhatsapp')}</label>
        </div>
      </div>

      {/* Ad-code allocation */}
      <div>
        <div className="text-sm font-medium">{t('ownerCodes')}</div>
        <p className="mb-2 mt-0.5 text-xs opacity-60">{draft.type === 'PERSONAL' ? t('ownerCodesPersonal') : t('ownerCodesHint')}</p>
        {draft.type !== 'PERSONAL' && (
          <div className="flex flex-wrap gap-1.5" dir="ltr">
            {poolFor(draft.type).map((code) => {
              const selected = draft.codes.includes(code);
              const disabled = !selected && taken.has(code); // owned by another owner
              return (
                <button
                  key={code}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleCode(code)}
                  className={`w-11 rounded-md border px-0 py-1.5 text-center font-num text-sm ${
                    selected ? 'border-gold bg-gold/20 font-bold text-gold-800' : disabled ? 'cursor-not-allowed border-graphite/10 bg-graphite/5 text-graphite/30 line-through' : 'border-graphite/25 hover:border-gold/60'
                  }`}
                >
                  {pad(code)}
                </button>
              );
            })}
          </div>
        )}
        {draft.type !== 'PERSONAL' && draft.codes.length > 0 && (
          <p className="mt-2 text-xs opacity-70" dir="ltr">{draft.codes.map(pad).join(' · ')}</p>
        )}
      </div>

      <label className="block text-sm">{t('details')}<textarea value={draft.details} onChange={(e) => setDraft({ ...draft, details: e.target.value })} rows={2} className={inp} /></label>
    </>
  );
}
