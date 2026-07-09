'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useLocale } from 'next-intl';
import { isValidPhone } from '@noc/config';
import { submitPartnerApplication } from './actions';

const inp = 'w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-base';

export function ApplyForm() {
  const locale = useLocale() as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [f, setF] = useState({ name: '', businessName: '', phone: '', email: '', businessType: '', areas: '', message: '' });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));

  const TYPES: { v: string; label: string }[] = [
    { v: 'individual', label: L('فرد / مالك', 'Individual / owner') },
    { v: 'broker', label: L('سمسار', 'Broker') },
    { v: 'company', label: L('شركة', 'Company') },
    { v: 'developer', label: L('مطوّر عقاري', 'Developer') },
    { v: 'other', label: L('أخرى', 'Other') },
  ];

  function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (f.name.trim().length < 2) { setError(L('اكتب اسمك', 'Enter your name')); return; }
    if (!isValidPhone(f.phone)) { setError(L('رقم الهاتف يجب أن يكون 11 رقمًا يبدأ بـ 01', 'Phone must be 11 digits starting with 01')); return; }
    start(async () => {
      const r = await submitPartnerApplication(f);
      if (r.ok) setDone(true);
      else if (r.error === 'rate') setError(L('محاولات كثيرة، حاول لاحقًا', 'Too many attempts, try later'));
      else if (r.error === 'phone') setError(L('رقم الهاتف غير صحيح', 'Invalid phone number'));
      else if (r.error === 'name') setError(L('اكتب اسمك', 'Enter your name'));
      else setError(L('تعذّر الإرسال، حاول مجددًا', 'Could not submit, try again'));
    });
  }

  if (done) {
    return (
      <div className="rounded-2xl border-2 border-green/40 bg-green/10 p-6 text-center">
        <div className="text-2xl">✅</div>
        <h3 className="mt-2 text-lg font-bold text-navy-800">{L('تم استلام طلبك', 'Application received')}</h3>
        <p className="mt-1 text-sm text-ink-600">{L('سيتواصل معك فريقنا قريبًا لمراجعة الطلب.', 'Our team will contact you soon to review your application.')}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-ink-200 bg-white p-5 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold text-navy-800">{L('الاسم', 'Your name')} *
          <input value={f.name} onChange={set('name')} className={`${inp} mt-1`} />
        </label>
        <label className="text-sm font-semibold text-navy-800">{L('اسم النشاط / الشركة', 'Business / company')}
          <input value={f.businessName} onChange={set('businessName')} className={`${inp} mt-1`} />
        </label>
        <label className="text-sm font-semibold text-navy-800">{L('رقم الهاتف', 'Phone')} *
          <input dir="ltr" inputMode="tel" placeholder="01xxxxxxxxx" value={f.phone} onChange={set('phone')} className={`${inp} mt-1`} />
        </label>
        <label className="text-sm font-semibold text-navy-800">{L('البريد الإلكتروني', 'Email')}
          <input dir="ltr" type="email" value={f.email} onChange={set('email')} className={`${inp} mt-1`} />
        </label>
        <label className="text-sm font-semibold text-navy-800">{L('نوع النشاط', 'Business type')}
          <select value={f.businessType} onChange={set('businessType')} className={`${inp} mt-1`}>
            <option value="">—</option>
            {TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold text-navy-800">{L('مناطق / فئات الاهتمام', 'Areas / categories of interest')}
          <input value={f.areas} onChange={set('areas')} className={`${inp} mt-1`} />
        </label>
      </div>
      <label className="block text-sm font-semibold text-navy-800">{L('نبذة عن نشاطك', 'Tell us about your business')}
        <textarea value={f.message} onChange={set('message')} rows={3} className={`${inp} mt-1`} />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={pending} className="w-full rounded-xl bg-primary px-4 py-3 text-base font-bold text-soft disabled:opacity-50 sm:w-auto sm:px-8">
        {pending ? L('جارٍ الإرسال…', 'Sending…') : L('إرسال الطلب', 'Submit application')}
      </button>
    </form>
  );
}
