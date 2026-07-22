'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { toast } from '@noc/ui';
import { runAction } from '@/app/admin/(protected)/runAction';
import { saveBrandContact, deleteBrandContact } from './actions';

export type Contact = { id: string; brand: string; type: string; value: string; isActive: boolean };

const TYPES: { v: string; label: readonly [string, string] }[] = [
  { v: 'phone', label: ['هاتف', 'Phone'] },
  { v: 'whatsapp', label: ['واتساب', 'WhatsApp'] },
  { v: 'email', label: ['بريد إلكتروني', 'Email'] },
  { v: 'website', label: ['موقع إلكتروني', 'Website'] },
  { v: 'address', label: ['عنوان', 'Address'] },
  { v: 'facebook', label: ['فيسبوك', 'Facebook'] },
  { v: 'instagram', label: ['انستجرام', 'Instagram'] },
];
const typeLabel = (t: string): readonly [string, string] => TYPES.find((x) => x.v === t)?.label ?? ([t, t] as const);

/** CRUD list of contacts for one brand — these feed the photo-stamp footer bar (with icons). */
export function ContactsManager({ brand, brandLabel, contacts }: { brand: string; brandLabel: string; contacts: Contact[] }) {
  const router = useRouter();
  const locale = useLocale() as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const [pending, start] = useTransition();
  const [type, setType] = useState('phone');
  const [value, setValue] = useState('');

  const add = () => {
    if (!value.trim()) return;
    start(async () => {
      const r = await saveBrandContact({ brand, type, value });
      if (r.ok) { setValue(''); router.refresh(); toast(L('تمت الإضافة ✓', 'Added ✓')); }
    });
  };
  const toggle = (c: Contact) =>
    start(async () => {
      const r = await saveBrandContact({ id: c.id, brand: c.brand, type: c.type, value: c.value, isActive: !c.isActive });
      if (r.ok) router.refresh();
    });
  const del = (id: string) =>
    start(async () => {
      const ok = await runAction(() => deleteBrandContact(id), {
        confirmText: L('حذف نهائيًا؟', 'Delete permanently?'),
        successText: L('تم الحذف', 'Deleted'),
        errorText: L('تعذّر الحذف', 'Delete failed'),
      });
      if (ok) router.refresh();
    });

  return (
    <div className="rounded-lg border border-graphite/15 bg-white/50 p-4">
      <h3 className="mb-2 text-sm font-bold text-primary">📇 {L('بيانات التواصل', 'Contact details')} — {brandLabel} <span className="font-normal opacity-60">{L('(تظهر في شريط التذييل بالأيقونات)', '(shown in the footer bar as icons)')}</span></h3>
      <div className="space-y-1.5">
        {contacts.length === 0 && <p className="text-xs opacity-50">{L('لا توجد بيانات مضافة — يستخدم التذييل رقم الهاتف والموقع من الإعدادات الحالية.', 'Nothing added yet — the footer falls back to the phone number and website from the current settings.')}</p>}
        {contacts.map((c) => (
          <div key={c.id} className={`flex items-center justify-between gap-2 rounded-md border border-graphite/10 px-3 py-1.5 text-sm ${!c.isActive ? 'opacity-50' : ''}`}>
            <span className="flex items-center gap-2">
              <span className="rounded bg-gold/15 px-2 py-0.5 text-xs font-medium">{L(...typeLabel(c.type))}</span>
              <span dir="ltr">{c.value}</span>
            </span>
            <span className="flex flex-none items-center gap-3">
              <button type="button" disabled={pending} onClick={() => toggle(c)} className="text-xs text-accent">{c.isActive ? L('إخفاء', 'Hide') : L('إظهار', 'Show')}</button>
              <button type="button" disabled={pending} onClick={() => del(c.id)} className="text-xs text-red-600">{L('حذف', 'Delete')}</button>
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-md border border-graphite/20 bg-transparent px-2 py-1.5 text-sm">
          {TYPES.map((t) => <option key={t.v} value={t.v}>{L(...t.label)}</option>)}
        </select>
        <input dir="ltr" value={value} onChange={(e) => setValue(e.target.value)} placeholder="01040810000 · alsawarey.com" className="min-w-[12rem] flex-1 rounded-md border border-graphite/20 bg-transparent px-3 py-1.5 text-sm" />
        <button type="button" disabled={pending || !value.trim()} onClick={add} className="rounded-md bg-primary px-4 py-1.5 text-sm text-soft disabled:opacity-50">{L('+ إضافة', '+ Add')}</button>
      </div>
    </div>
  );
}
