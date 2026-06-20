'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { upsertPartner, deleteUser } from '../users/actions';

type P = { id: string; name: string; phone: string; email: string; partnerKind: string; isActive: boolean };
type Draft = { id?: string; name: string; phone: string; email: string; partnerKind: 'BROKER' | 'COMPANY'; isActive: boolean };
const inp = 'w-full rounded border border-graphite/20 bg-transparent px-2 py-1 text-sm';

export function PartnersManager({ partners }: { partners: P[] }) {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');

  function save() {
    if (!draft) return;
    setError('');
    start(async () => {
      const r = await upsertPartner(draft);
      if (r.ok) {
        setDraft(null);
        router.refresh();
      } else setError(r.error);
    });
  }
  function del(id: string) {
    if (!confirm(t('confirmDelete'))) return;
    setError('');
    start(async () => {
      const r = await deleteUser(id);
      if (!r.ok) setError(r.error);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="overflow-x-auto rounded-lg border border-graphite/15">
        <table className="w-full text-sm">
          <thead className="opacity-60">
            <tr>
              <th className="p-2 text-start">{t('name')}</th>
              <th className="p-2 text-start">{t('partnerKind')}</th>
              <th className="p-2 text-start">{t('phone')}</th>
              <th className="p-2 text-start">{t('email')}</th>
              <th className="p-2 text-start">{t('active')}</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {partners.length === 0 && (
              <tr><td colSpan={6} className="p-4 text-center opacity-60">{t('noUsers')}</td></tr>
            )}
            {partners.map((u) => (
              <tr key={u.id} className="border-t border-graphite/10">
                <td className="p-2 font-medium">{u.name}</td>
                <td className="p-2">{t(`kind${u.partnerKind}`)}</td>
                <td className="p-2" dir="ltr">{u.phone || '—'}</td>
                <td className="p-2" dir="ltr">{u.email || '—'}</td>
                <td className="p-2">{u.isActive ? '✔' : '—'}</td>
                <td className="whitespace-nowrap p-2 text-end">
                  <button onClick={() => setDraft({ id: u.id, name: u.name, phone: u.phone, email: u.email, partnerKind: u.partnerKind === 'COMPANY' ? 'COMPANY' : 'BROKER', isActive: u.isActive })} className="px-2 py-1 text-accent">{t('edit')}</button>
                  <button disabled={pending} onClick={() => del(u.id)} className="px-2 py-1 text-red-600">{t('delete')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {draft ? (
        <div className="space-y-3 rounded-lg border border-graphite/15 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">{t('name')}<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inp} /></label>
            <label className="text-sm">{t('partnerKind')}
              <select value={draft.partnerKind} onChange={(e) => setDraft({ ...draft, partnerKind: e.target.value as Draft['partnerKind'] })} className={inp}>
                <option value="BROKER">{t('kindBROKER')}</option>
                <option value="COMPANY">{t('kindCOMPANY')}</option>
              </select>
            </label>
            <label className="text-sm">{t('phone')}<input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} dir="ltr" placeholder="01XXXXXXXXX" className={inp} /></label>
            <label className="text-sm">{t('email')}<input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} dir="ltr" className={inp} /></label>
            <label className="flex items-end gap-2 text-sm"><input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} /> {t('active')}</label>
          </div>
          <div className="flex items-center gap-2">
            <button disabled={pending || !draft.name.trim()} onClick={save} className="rounded bg-primary px-4 py-2 text-sm text-soft disabled:opacity-50">{tc('save')}</button>
            <button onClick={() => setDraft(null)} className="px-3 py-2 text-sm opacity-70">{tc('cancel')}</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setDraft({ name: '', phone: '', email: '', partnerKind: 'BROKER', isActive: true })} className="rounded-md border border-graphite/25 px-3 py-1.5 text-sm hover:bg-graphite/10">+ {t('addPartner')}</button>
      )}
    </div>
  );
}
