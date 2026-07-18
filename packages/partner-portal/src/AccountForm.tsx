'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@noc/ui';
import { partnerUpdateAccount } from './actions';

const inp = 'w-full rounded-md border border-graphite/20 bg-transparent px-3 py-3 text-base';

export function AccountForm({
  initial,
  locale,
}: {
  initial: { username: string; email: string; phone: string; hasPassword: boolean };
  locale: 'ar' | 'en';
}) {
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState({ username: initial.username, email: initial.email, phone: initial.phone, password: '' });
  const [showPw, setShowPw] = useState(false); // reveal what's typed so the partner can confirm it

  function save() {
    start(async () => {
      const r = await partnerUpdateAccount(f);
      if (r.ok) {
        toast(L('تم حفظ الحساب', 'Account saved'));
        setF((p) => ({ ...p, password: '' }));
        router.refresh();
      } else {
        toast(
          r.error === 'identifier_required'
            ? L('أبقِ وسيلة دخول واحدة على الأقل', 'Keep at least one login identifier')
            : r.error === 'invalid_phone'
              ? L('رقم الهاتف غير صالح', 'Invalid phone')
              : r.error === 'duplicate_key'
                ? L('اسم المستخدم / البريد / الهاتف مستخدم بالفعل', 'Username / email / phone already in use')
                : L('تعذّر الحفظ', 'Save failed'),
          'error',
        );
      }
    });
  }

  return (
    <div className="max-w-lg space-y-4 rounded-lg border border-ink-200 bg-white p-6 shadow-sm">
      <label className="block text-sm font-semibold">
        {L('اسم المستخدم', 'Username')}
        <input dir="ltr" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} className={`${inp} mt-1`} />
      </label>
      <label className="block text-sm font-semibold">
        {L('البريد الإلكتروني', 'Email')}
        <input dir="ltr" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={`${inp} mt-1`} />
      </label>
      <label className="block text-sm font-semibold">
        {L('الهاتف (يستقبل رمز الدخول)', 'Phone (receives the login code)')}
        <input dir="ltr" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className={`${inp} mt-1`} />
      </label>
      <label className="block text-sm font-semibold">
        {L('كلمة مرور جديدة', 'New password')}
        <span className="relative mt-1 block">
          <input
            dir="ltr"
            type={showPw ? 'text' : 'password'}
            value={f.password}
            onChange={(e) => setF({ ...f, password: e.target.value })}
            placeholder={initial.hasPassword ? L('اتركها فارغة للإبقاء على الحالية', 'Leave empty to keep the current one') : L('اختياري', 'Optional')}
            className={`${inp} pe-16`}
          />
          <button
            type="button"
            onClick={() => setShowPw((s) => !s)}
            className="absolute inset-y-0 end-2 my-auto h-8 rounded-md px-2 text-xs font-bold text-gold-700 hover:bg-gold/10"
            aria-pressed={showPw}
          >
            {showPw ? L('إخفاء', 'Hide') : L('👁 إظهار', '👁 Show')}
          </button>
        </span>
        <span className="mt-1 block text-xs font-normal text-ink-500">
          {L('اكتب كلمة مرور جديدة واضغط «إظهار» للتأكد منها. لا يمكن عرض كلمة المرور الحالية لأنها محفوظة مشفّرة.',
             'Type a new password and tap “Show” to confirm it. The current password can’t be displayed — it’s stored encrypted.')}
        </span>
      </label>
      <button onClick={save} disabled={pending} className="w-full rounded-lg bg-primary px-4 py-3 text-base font-bold text-soft disabled:opacity-50">
        {pending ? L('جارٍ الحفظ…', 'Saving…') : L('حفظ', 'Save')}
      </button>
    </div>
  );
}
