'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@noc/ui';
import { saveBrandContact, deleteBrandContact } from './actions';

export type Contact = { id: string; brand: string; type: string; value: string; isActive: boolean };

const TYPES = [
  { v: 'phone', label: 'هاتف' },
  { v: 'whatsapp', label: 'واتساب' },
  { v: 'email', label: 'بريد إلكتروني' },
  { v: 'website', label: 'موقع إلكتروني' },
  { v: 'address', label: 'عنوان' },
  { v: 'facebook', label: 'فيسبوك' },
  { v: 'instagram', label: 'انستجرام' },
];
const typeLabel = (t: string) => TYPES.find((x) => x.v === t)?.label ?? t;

/** CRUD list of contacts for one brand — these feed the photo-stamp footer bar (with icons). */
export function ContactsManager({ brand, brandLabel, contacts }: { brand: string; brandLabel: string; contacts: Contact[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [type, setType] = useState('phone');
  const [value, setValue] = useState('');

  const add = () => {
    if (!value.trim()) return;
    start(async () => {
      const r = await saveBrandContact({ brand, type, value });
      if (r.ok) { setValue(''); router.refresh(); toast('تمت الإضافة ✓'); }
    });
  };
  const toggle = (c: Contact) =>
    start(async () => {
      const r = await saveBrandContact({ id: c.id, brand: c.brand, type: c.type, value: c.value, isActive: !c.isActive });
      if (r.ok) router.refresh();
    });
  const del = (id: string) =>
    start(async () => {
      const r = await deleteBrandContact(id);
      if (r.ok) { router.refresh(); toast('تم الحذف'); }
    });

  return (
    <div className="rounded-lg border border-graphite/15 bg-white/50 p-4">
      <h3 className="mb-2 text-sm font-bold text-primary">📇 بيانات التواصل — {brandLabel} <span className="font-normal opacity-60">(تظهر في شريط التذييل بالأيقونات)</span></h3>
      <div className="space-y-1.5">
        {contacts.length === 0 && <p className="text-xs opacity-50">لا توجد بيانات مضافة — يستخدم التذييل رقم الهاتف والموقع من الإعدادات الحالية.</p>}
        {contacts.map((c) => (
          <div key={c.id} className={`flex items-center justify-between gap-2 rounded-md border border-graphite/10 px-3 py-1.5 text-sm ${!c.isActive ? 'opacity-50' : ''}`}>
            <span className="flex items-center gap-2">
              <span className="rounded bg-gold/15 px-2 py-0.5 text-xs font-medium">{typeLabel(c.type)}</span>
              <span dir="ltr">{c.value}</span>
            </span>
            <span className="flex flex-none items-center gap-3">
              <button type="button" disabled={pending} onClick={() => toggle(c)} className="text-xs text-accent">{c.isActive ? 'إخفاء' : 'إظهار'}</button>
              <button type="button" disabled={pending} onClick={() => del(c.id)} className="text-xs text-red-600">حذف</button>
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-md border border-graphite/20 bg-transparent px-2 py-1.5 text-sm">
          {TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
        </select>
        <input dir="ltr" value={value} onChange={(e) => setValue(e.target.value)} placeholder="01040810000 · alsawarey.com" className="min-w-[12rem] flex-1 rounded-md border border-graphite/20 bg-transparent px-3 py-1.5 text-sm" />
        <button type="button" disabled={pending || !value.trim()} onClick={add} className="rounded-md bg-primary px-4 py-1.5 text-sm text-soft disabled:opacity-50">+ إضافة</button>
      </div>
    </div>
  );
}
