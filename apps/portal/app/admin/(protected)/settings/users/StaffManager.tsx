'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { upsertStaff, deleteUser } from './actions';

type RoleOption = { key: string; name: string };
type Staff = { id: string; email: string; name: string; isActive: boolean; roleKeys: string[] };
type Draft = { id?: string; email: string; name: string; password: string; isActive: boolean; roleKeys: string[] };
const inp = 'w-full rounded border border-graphite/20 bg-transparent px-2 py-1 text-sm';

export function StaffManager({ staff, roleOptions }: { staff: Staff[]; roleOptions: RoleOption[] }) {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');

  const blank: Draft = { email: '', name: '', password: '', isActive: true, roleKeys: [] };
  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const roleName = (k: string) => roleOptions.find((r) => r.key === k)?.name ?? k;

  function save() {
    if (!draft) return;
    setError('');
    start(async () => {
      const r = await upsertStaff(draft);
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
              <th className="p-2 text-start">{t('email')}</th>
              <th className="p-2 text-start">{t('role')}</th>
              <th className="p-2 text-start">{t('active')}</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {staff.length === 0 && (
              <tr><td colSpan={5} className="p-4 text-center opacity-60">{t('noUsers')}</td></tr>
            )}
            {staff.map((u) => (
              <tr key={u.id} className="border-t border-graphite/10">
                <td className="p-2 font-medium">{u.name || '—'}</td>
                <td className="p-2" dir="ltr">{u.email}</td>
                <td className="p-2 text-xs opacity-70">{u.roleKeys.length ? u.roleKeys.map(roleName).join('، ') : '—'}</td>
                <td className="p-2">{u.isActive ? '✔' : '—'}</td>
                <td className="whitespace-nowrap p-2 text-end">
                  <button onClick={() => setDraft({ id: u.id, email: u.email, name: u.name, password: '', isActive: u.isActive, roleKeys: u.roleKeys })} className="px-2 py-1 text-accent">{t('edit')}</button>
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
            <label className="text-sm">{t('email')}<input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} dir="ltr" className={inp} /></label>
            <label className="text-sm">{draft.id ? t('newPasswordOptional') : t('password')}<input type="password" value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} dir="ltr" placeholder={draft.id ? '••••••' : ''} className={inp} /></label>
            <label className="flex items-end gap-2 text-sm"><input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} /> {t('active')}</label>
          </div>
          <div className="text-sm">
            <div className="mb-1 opacity-70">{t('roles')}</div>
            <div className="flex flex-wrap gap-2">
              {roleOptions.map((r) => (
                <label key={r.key} className={`cursor-pointer rounded border px-3 py-1.5 ${draft.roleKeys.includes(r.key) ? 'border-accent bg-accent/10' : 'border-graphite/20'}`}>
                  <input type="checkbox" className="hidden" checked={draft.roleKeys.includes(r.key)} onChange={() => setDraft({ ...draft, roleKeys: toggle(draft.roleKeys, r.key) })} /> {r.name}
                </label>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button disabled={pending || !draft.email.trim()} onClick={save} className="rounded bg-primary px-4 py-2 text-sm text-soft disabled:opacity-50">{tc('save')}</button>
            <button onClick={() => setDraft(null)} className="px-3 py-2 text-sm opacity-70">{tc('cancel')}</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setDraft(blank)} className="rounded-md border border-graphite/25 px-3 py-1.5 text-sm hover:bg-graphite/10">+ {t('addStaff')}</button>
      )}
    </div>
  );
}
