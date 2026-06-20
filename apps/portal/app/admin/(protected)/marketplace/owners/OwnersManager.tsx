'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { upsertOwner, deleteOwner } from '../actions';

type OwnerType = 'OWNER' | 'COMPANY' | 'BROKER' | 'US';
type Owner = { id: string; name: string; type: OwnerType; phone1: string | null; phone1Whatsapp: boolean; phone2: string | null; phone2Whatsapp: boolean; details: string | null };
type Draft = { id?: string; name: string; type: OwnerType; phone1: string; phone1Whatsapp: boolean; phone2: string; phone2Whatsapp: boolean; details: string };

const EMPTY: Draft = { name: '', type: 'OWNER', phone1: '', phone1Whatsapp: false, phone2: '', phone2Whatsapp: false, details: '' };
const TYPES: OwnerType[] = ['OWNER', 'COMPANY', 'BROKER', 'US'];
const inp = 'w-full rounded-md border border-graphite/20 bg-transparent px-3 py-2 text-sm';

export function OwnersManager({ initial }: { initial: Owner[] }) {
  const t = useTranslations('mp');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');

  function save() {
    if (!draft || !draft.name.trim()) { setError('failed'); return; }
    setError('');
    start(async () => {
      const r = await upsertOwner(draft);
      if (r.ok) { setDraft(null); router.refresh(); }
      else setError(r.error);
    });
  }
  function del(id: string) {
    start(async () => {
      const r = await deleteOwner(id);
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {draft ? (
        <div className="space-y-3 rounded-lg border border-graphite/15 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">{t('ownerName')}<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inp} /></label>
            <label className="text-sm">{t('ownerType')}
              <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as OwnerType })} className={inp}>
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
          <label className="block text-sm">{t('details')}<textarea value={draft.details} onChange={(e) => setDraft({ ...draft, details: e.target.value })} rows={2} className={inp} /></label>
          <div className="flex gap-2">
            <button disabled={pending} onClick={save} className="rounded-md bg-primary px-4 py-2 text-sm text-soft disabled:opacity-50">{t('save')}</button>
            <button onClick={() => setDraft(null)} className="px-4 py-2 text-sm opacity-70">{t('cancel')}</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setDraft({ ...EMPTY })} className="rounded-md bg-primary px-3 py-1.5 text-sm text-soft">+ {t('add')}</button>
      )}

      <div className="space-y-2">
        {initial.map((o) => (
          <div key={o.id} className="flex items-center justify-between gap-3 rounded-lg border border-graphite/15 p-3">
            <div>
              <span className="font-semibold">{o.name}</span>{' '}
              <span className="rounded bg-graphite/10 px-2 py-0.5 text-xs">{t(`type${o.type}`)}</span>
              <div className="text-xs opacity-70" dir="ltr">
                {[o.phone1 && `${o.phone1}${o.phone1Whatsapp ? ' (WA)' : ''}`, o.phone2 && `${o.phone2}${o.phone2Whatsapp ? ' (WA)' : ''}`].filter(Boolean).join('  ·  ')}
              </div>
              {o.details && <div className="text-xs opacity-60">{o.details}</div>}
            </div>
            <div className="flex gap-3 text-sm">
              <button onClick={() => setDraft({ id: o.id, name: o.name, type: o.type, phone1: o.phone1 ?? '', phone1Whatsapp: o.phone1Whatsapp, phone2: o.phone2 ?? '', phone2Whatsapp: o.phone2Whatsapp, details: o.details ?? '' })} className="text-accent">{t('edit')}</button>
              <button disabled={pending} onClick={() => del(o.id)} className="text-red-600">{t('delete')}</button>
            </div>
          </div>
        ))}
        {initial.length === 0 && <p className="text-sm opacity-50">{t('none')}</p>}
      </div>
    </div>
  );
}
