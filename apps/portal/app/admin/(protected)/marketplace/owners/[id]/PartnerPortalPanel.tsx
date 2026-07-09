'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@noc/ui';
import { savePartnerAccount, setOwnerAllowedCategories, setOwnerBrowseListings, type PartnerAccountInput } from '../../actions';

type TypeOpt = { id: string; nameAr: string; nameEn: string };
const inp = 'w-full rounded-md border border-graphite/20 bg-transparent px-3 py-2 text-sm';

/** Admin control of an owner's partner-portal access: the login account (username /
 *  email / phone + password + active) and the Type categories they may post in. */
export function PartnerPortalPanel({
  ownerId,
  account,
  typeOptions,
  granted,
  canBrowse,
  locale,
}: {
  ownerId: string;
  account: { exists: boolean; username: string; email: string; phone: string; isActive: boolean; hasPassword: boolean };
  typeOptions: TypeOpt[];
  granted: string[];
  canBrowse: boolean;
  locale: 'ar' | 'en';
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const [f, setF] = useState<PartnerAccountInput>({
    username: account.username,
    email: account.email,
    phone: account.phone,
    password: '',
    isActive: account.isActive,
  });
  const [cats, setCats] = useState<Set<string>>(new Set(granted));
  const [browse, setBrowse] = useState(canBrowse);

  function toggleBrowse(next: boolean) {
    setBrowse(next);
    start(async () => {
      const r = await setOwnerBrowseListings(ownerId, next);
      if (r.ok) { toast(L('تم الحفظ', 'Saved')); router.refresh(); }
      else { setBrowse(!next); toast(L('تعذّر الحفظ', 'Save failed'), 'error'); }
    });
  }

  function saveAccount() {
    start(async () => {
      const r = await savePartnerAccount(ownerId, f);
      if (r.ok) {
        toast(L('تم حفظ حساب الشريك', 'Partner account saved'));
        setF((p) => ({ ...p, password: '' }));
        router.refresh();
      } else {
        toast(
          r.error === 'identifier_required'
            ? L('أدخل اسم مستخدم أو بريدًا أو هاتفًا واحدًا على الأقل', 'Enter at least one of username / email / phone')
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

  function saveCats() {
    start(async () => {
      const r = await setOwnerAllowedCategories(ownerId, [...cats]);
      if (r.ok) { toast(L('تم حفظ الفئات المسموحة', 'Allowed categories saved')); router.refresh(); }
      else toast(L('تعذّر الحفظ', 'Save failed'), 'error');
    });
  }

  return (
    <section className="space-y-4 rounded-lg border border-gold-300/50 bg-gold/10 p-4">
      <h2 className="font-bold text-primary">🔑 {L('بوابة الشريك', 'Partner portal')}</h2>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm">
          {L('اسم المستخدم', 'Username')}
          <input dir="ltr" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} className={`${inp} mt-1`} />
        </label>
        <label className="text-sm">
          {L('البريد الإلكتروني', 'Email')}
          <input dir="ltr" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={`${inp} mt-1`} />
        </label>
        <label className="text-sm">
          {L('الهاتف (للدخول ورمز التحقق)', 'Phone (login + OTP)')}
          <input dir="ltr" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className={`${inp} mt-1`} />
        </label>
        <label className="text-sm">
          {L('كلمة المرور', 'Password')}
          <input
            dir="ltr"
            type="text"
            value={f.password}
            onChange={(e) => setF({ ...f, password: e.target.value })}
            placeholder={account.hasPassword ? L('اتركها فارغة للإبقاء عليها', 'Leave empty to keep') : L('اختياري — يمكن الدخول برمز التحقق', 'Optional — OTP login works')}
            className={`${inp} mt-1`}
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} />
          {L('الدخول مفعّل', 'Login enabled')}
        </label>
        <button onClick={saveAccount} disabled={pending} className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-soft disabled:opacity-50">
          {account.exists ? L('حفظ الحساب', 'Save account') : L('إنشاء الحساب', 'Create account')}
        </button>
        {account.exists && (
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${account.isActive ? 'bg-green/15 text-green' : 'bg-graphite/10 opacity-70'}`}>
            {account.isActive ? L('نشط', 'Active') : L('موقوف', 'Disabled')}
          </span>
        )}
      </div>

      <div className="space-y-2 border-t border-gold-300/40 pt-3">
        <div className="text-sm font-bold text-primary">{L('الفئات المسموح النشر فيها', 'Categories allowed for posting')}</div>
        <p className="text-xs opacity-70">
          {L('بدون أي فئة محددة لا يستطيع الشريك إضافة إعلانات جديدة (يظل يرى إعلاناته ويعدّل أسعارها).', 'With no categories granted the partner cannot create listings (they can still see and fast-edit their own).')}
        </p>
        <div className="flex flex-wrap gap-2">
          {typeOptions.map((o) => {
            const on = cats.has(o.id);
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => setCats((s) => { const n = new Set(s); if (n.has(o.id)) n.delete(o.id); else n.add(o.id); return n; })}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold ${on ? 'bg-primary text-soft' : 'border border-graphite/25 hover:bg-graphite/10'}`}
              >
                {L(o.nameAr, o.nameEn)}
              </button>
            );
          })}
        </div>
        <button onClick={saveCats} disabled={pending} className="rounded-md border border-graphite/25 px-4 py-1.5 text-sm font-semibold hover:bg-graphite/10 disabled:opacity-50">
          {L('حفظ الفئات', 'Save categories')} ({cats.size})
        </button>
      </div>

      <div className="space-y-1 border-t border-gold-300/40 pt-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-primary">
          <input type="checkbox" checked={browse} disabled={pending} onChange={(e) => toggleBrowse(e.target.checked)} />
          {L('يمكنه تصفّح جميع العروض (للاطّلاع فقط)', 'Can browse all offers (view only)')}
        </label>
        <p className="text-xs opacity-70">
          {L('يظهر فقط إذا كان الخيار العام مفعّلاً من صفحة الملاك.', 'Only takes effect when the global switch on the Owners page is on.')}
        </p>
      </div>
    </section>
  );
}
