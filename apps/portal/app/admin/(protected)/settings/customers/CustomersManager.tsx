'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { upsertCustomer, deleteUser, setCustomerVerified } from '../users/actions';

type C = { id: string; phone: string; name: string; isActive: boolean; verified: boolean; follows: number; lands: number };
type Draft = { id?: string; phone: string; name: string; isActive: boolean };
const inp = 'w-full rounded border border-graphite/20 bg-transparent px-2 py-1 text-sm';

export function CustomersManager({ customers }: { customers: C[] }) {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');
  const [unverifiedOnly, setUnverifiedOnly] = useState(false);

  const pendingCount = customers.filter((c) => !c.verified).length;
  const shown = unverifiedOnly ? customers.filter((c) => !c.verified) : customers;

  function save() {
    if (!draft) return;
    setError('');
    start(async () => {
      const r = await upsertCustomer(draft);
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
  function verify(id: string, v: boolean) {
    setError('');
    start(async () => {
      const r = await setCustomerVerified(id, v);
      if (!r.ok) setError(r.error);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {pendingCount > 0 && (
          <span className="rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-800">
            {t('pendingVerify')}: {pendingCount}
          </span>
        )}
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={unverifiedOnly} onChange={(e) => setUnverifiedOnly(e.target.checked)} />
          {t('showUnverifiedOnly')}
        </label>
      </div>
      <div className="overflow-x-auto rounded-lg border border-graphite/15">
        <table className="w-full text-sm">
          <thead className="opacity-60">
            <tr>
              <th className="p-2 text-start">{t('name')}</th>
              <th className="p-2 text-start">{t('phone')}</th>
              <th className="p-2 text-start">{t('activity')}</th>
              <th className="p-2 text-start">{t('verified')}</th>
              <th className="p-2 text-start">{t('active')}</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr><td colSpan={6} className="p-4 text-center opacity-60">{t('noUsers')}</td></tr>
            )}
            {shown.map((u) => (
              <tr key={u.id} className={`border-t border-graphite/10 ${!u.verified ? 'bg-amber-50/60' : ''}`}>
                <td className="p-2 font-medium">{u.name || '—'}</td>
                <td className="p-2" dir="ltr">{u.phone}</td>
                <td className="whitespace-nowrap p-2 opacity-75">
                  {t('followsShort')}: {u.follows} · {t('landsShort')}: {u.lands}
                </td>
                <td className="p-2">{u.verified ? '✔' : <span className="text-amber-700">{t('pending')}</span>}</td>
                <td className="p-2">{u.isActive ? '✔' : '—'}</td>
                <td className="whitespace-nowrap p-2 text-end">
                  {!u.verified && (
                    <button disabled={pending} onClick={() => verify(u.id, true)} className="px-2 py-1 font-medium text-green">{t('verify')}</button>
                  )}
                  <button onClick={() => setDraft({ id: u.id, phone: u.phone, name: u.name, isActive: u.isActive })} className="px-2 py-1 text-accent">{t('edit')}</button>
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
            <label className="text-sm">{t('phone')}<input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} dir="ltr" placeholder="01XXXXXXXXX" className={inp} /></label>
            <label className="flex items-end gap-2 text-sm"><input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} /> {t('active')}</label>
          </div>
          <div className="flex items-center gap-2">
            <button disabled={pending || !draft.phone.trim()} onClick={save} className="rounded bg-primary px-4 py-2 text-sm text-soft disabled:opacity-50">{tc('save')}</button>
            <button onClick={() => setDraft(null)} className="px-3 py-2 text-sm opacity-70">{tc('cancel')}</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setDraft({ phone: '', name: '', isActive: true })} className="rounded-md border border-graphite/25 px-3 py-1.5 text-sm hover:bg-graphite/10">+ {t('addCustomer')}</button>
      )}
    </div>
  );
}
