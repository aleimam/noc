'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from '@noc/ui';
import { isValidPhone } from '@noc/config';
import { saveOwnerFull, deleteOwner, type OwnerFullInput } from '../../actions';
import { OwnerFields, OwnerCodesPicker, type OwnerDraft } from '../OwnerFields';

// Unified single-owner editor (owner detail page). ONE Save + ONE Reset at the bottom of the
// page persist EVERYTHING together via saveOwnerFull: owner info (name / type / phones /
// details), the partner-portal access block (account, site toggles, category grants, browse
// flag) and the ad-code allocation (bottom card, just above the Save row). Delete stays an
// instant one-off action.

type TypeOpt = { id: string; nameAr: string; nameEn: string };

export type PartnerInitial = {
  exists: boolean; // a partner login (User) already exists for this owner
  username: string;
  email: string;
  phone: string;
  isActive: boolean;
  hasPassword: boolean;
  siteNewObour: boolean;
  siteAlsawary: boolean;
  categories: string[];
  canBrowse: boolean;
};

type PartnerDraft = {
  username: string;
  email: string;
  phone: string;
  password: string;
  isActive: boolean;
  siteNewObour: boolean;
  siteAlsawary: boolean;
  categories: string[];
  canBrowse: boolean;
};

const inp = 'w-full rounded-md border border-graphite/20 bg-transparent px-3 py-2 text-sm';
const card = 'space-y-3 rounded-lg border border-graphite/15 p-4';
const h2 = 'font-semibold text-primary';

function partnerDraftFrom(p: PartnerInitial): PartnerDraft {
  return {
    username: p.username,
    email: p.email,
    phone: p.phone,
    password: '',
    isActive: p.isActive,
    siteNewObour: p.siteNewObour,
    siteAlsawary: p.siteAlsawary,
    categories: [...p.categories],
    canBrowse: p.canBrowse,
  };
}

export function OwnerEditor({
  initial,
  takenCodes,
  partner,
  typeOptions,
  favicons,
  locale,
  children,
}: {
  initial: OwnerDraft;
  takenCodes: number[];
  partner: PartnerInitial;
  typeOptions: TypeOpt[];
  /** Small site icons for the site-access toggles (real favicons, admin-uploaded). */
  favicons: { newObour: string; alsawarey: string };
  locale: 'ar' | 'en';
  /** Server-rendered read-only cards (listings / lands) shown between the editable
   *  sections and the ad-codes card, so the Save row stays at the bottom of the page. */
  children?: React.ReactNode;
}) {
  const t = useTranslations('mp');
  const tc = useTranslations('common');
  const router = useRouter();
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<OwnerDraft>(initial);
  const [pf, setPf] = useState<PartnerDraft>(partnerDraftFrom(partner));
  const [error, setError] = useState('');
  const taken = new Set(takenCodes);

  const errMsg = (code: string) =>
    code === 'owner_code_taken' ? t('ownerCodeTaken')
    : code === 'owner_code_range' ? t('ownerCodesHint')
    : code === 'invalid_phone' ? tc('phoneInvalid')
    : code === 'identifier_required'
      ? L('حساب الشريك موجود بالفعل — أدخل اسم مستخدم أو بريدًا أو هاتفًا واحدًا على الأقل', 'The partner account exists — keep at least one of username / email / phone')
    : code === 'duplicate_key'
      ? L('اسم المستخدم / البريد / الهاتف مستخدم بالفعل', 'Username / email / phone already in use')
    : 'تعذّر الحفظ / Save failed';

  function save() {
    if (!draft.name.trim()) { setError('failed'); return; }
    if (draft.phone1.trim() && !isValidPhone(draft.phone1)) { setError('invalid_phone'); return; }
    if (draft.phone2.trim() && !isValidPhone(draft.phone2)) { setError('invalid_phone'); return; }
    if (draft.type !== 'US' && pf.phone.trim() && !isValidPhone(pf.phone)) { setError('invalid_phone'); return; }
    setError('');
    const input: OwnerFullInput = {
      id: initial.id!,
      name: draft.name,
      type: draft.type,
      codes: draft.type === 'PERSONAL' ? [] : draft.codes,
      phone1: draft.phone1,
      phone1Whatsapp: draft.phone1Whatsapp,
      phone2: draft.phone2,
      phone2Whatsapp: draft.phone2Whatsapp,
      details: draft.details,
      partner: draft.type === 'US' ? null : { ...pf, categories: [...pf.categories] },
    };
    start(async () => {
      const r = await saveOwnerFull(input);
      if (r.ok) {
        setPf((p) => ({ ...p, password: '' }));
        toast(t('savedOk'));
        router.refresh();
      } else {
        setError(r.error);
      }
    });
  }

  function reset() {
    setDraft(initial);
    setPf(partnerDraftFrom(partner));
    setError('');
  }

  function del() {
    if (!initial.id) return;
    if (!window.confirm('حذف نهائيًا؟ / Delete permanently?')) return;
    start(async () => {
      const r = await deleteOwner(initial.id!);
      if (r.ok) { toast(t('deleted')); router.push('/admin/marketplace/owners'); }
      else setError(r.error);
    });
  }

  const toggleCat = (id: string) =>
    setPf((p) => ({ ...p, categories: p.categories.includes(id) ? p.categories.filter((c) => c !== id) : [...p.categories, id] }));

  const siteToggle = (checked: boolean, onChange: (v: boolean) => void, icon: string, label: string) => (
    <label className="flex items-center gap-2 text-sm font-semibold">
      <input type="checkbox" checked={checked} disabled={pending} onChange={(e) => onChange(e.target.checked)} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={icon} alt="" className="h-5 w-5 rounded object-contain" />
      {label}
    </label>
  );

  return (
    <div className="space-y-6">
      {/* Owner info */}
      <section className={card}>
        <h2 className={h2}>{L('بيانات المالك', 'Owner info')}</h2>
        <OwnerFields draft={draft} setDraft={setDraft} taken={taken} showCodes={false} />
      </section>

      {/* Partner-portal access (not for US) — saved with the same bottom Save button. */}
      {draft.type !== 'US' && (
        <section className={card}>
          <h2 className={h2}>🔑 {L('بوابة الشريك', 'Partner portal')}</h2>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm">
              {L('اسم المستخدم', 'Username')}
              <input dir="ltr" value={pf.username} onChange={(e) => setPf({ ...pf, username: e.target.value })} className={`${inp} mt-1`} />
            </label>
            <label className="text-sm">
              {L('البريد الإلكتروني', 'Email')}
              <input dir="ltr" type="email" value={pf.email} onChange={(e) => setPf({ ...pf, email: e.target.value })} className={`${inp} mt-1`} />
            </label>
            <label className="text-sm">
              {L('الهاتف (للدخول ورمز التحقق)', 'Phone (login + OTP)')}
              <input dir="ltr" type="tel" value={pf.phone} onChange={(e) => setPf({ ...pf, phone: e.target.value })} className={`${inp} mt-1`} />
            </label>
            <label className="text-sm">
              {L('كلمة المرور', 'Password')}
              <input
                dir="ltr"
                type="text"
                value={pf.password}
                onChange={(e) => setPf({ ...pf, password: e.target.value })}
                placeholder={partner.hasPassword ? L('اتركها فارغة للإبقاء عليها', 'Leave empty to keep') : L('اختياري — يمكن الدخول برمز التحقق', 'Optional — OTP login works')}
                className={`${inp} mt-1`}
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={pf.isActive} onChange={(e) => setPf({ ...pf, isActive: e.target.checked })} />
              {L('الدخول مفعّل', 'Login enabled')}
            </label>
            {partner.exists ? (
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${partner.isActive ? 'bg-green/15 text-green' : 'bg-graphite/10 opacity-70'}`}>
                {partner.isActive ? L('نشط', 'Active') : L('موقوف', 'Disabled')}
              </span>
            ) : (
              <span className="text-xs opacity-60">
                {L('لا يوجد حساب بعد — يُنشأ عند الحفظ إذا أدخلت اسم مستخدم أو بريدًا أو هاتفًا.', 'No account yet — created on Save once a username / email / phone is entered.')}
              </span>
            )}
          </div>

          <div className="space-y-2 border-t border-graphite/15 pt-3">
            <div className="text-sm font-bold text-primary">{L('المواقع المتاحة للشريك', 'Sites this partner can access')}</div>
            <p className="text-xs opacity-70">{L('يحدّد أين يسجّل الشريك دخوله وأين تظهر إعلاناته.', 'Controls where the partner can sign in and where their listings appear.')}</p>
            <div className="flex flex-wrap gap-4">
              {siteToggle(pf.siteNewObour, (v) => setPf({ ...pf, siteNewObour: v }), favicons.newObour, L('العبور الجديدة', 'New Obour'))}
              {siteToggle(pf.siteAlsawary, (v) => setPf({ ...pf, siteAlsawary: v }), favicons.alsawarey, L('الصواري', 'Al Sawarey'))}
            </div>
          </div>

          <div className="space-y-2 border-t border-graphite/15 pt-3">
            <div className="text-sm font-bold text-primary">{L('الفئات المسموح النشر فيها', 'Categories allowed for posting')}</div>
            <p className="text-xs opacity-70">
              {L('بدون أي فئة محددة لا يستطيع الشريك إضافة إعلانات جديدة (يظل يرى إعلاناته ويعدّل أسعارها).', 'With no categories granted the partner cannot create listings (they can still see and fast-edit their own).')}
            </p>
            <div className="flex flex-wrap gap-2">
              {typeOptions.map((o) => {
                const on = pf.categories.includes(o.id);
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => toggleCat(o.id)}
                    className={`rounded-full px-3 py-1.5 text-sm font-semibold ${on ? 'bg-primary text-soft' : 'border border-graphite/25 hover:bg-graphite/10'}`}
                  >
                    {L(o.nameAr, o.nameEn)}
                  </button>
                );
              })}
            </div>
            <p className="text-xs opacity-60">{L('المحدد', 'Selected')}: {pf.categories.length}</p>
          </div>

          <div className="space-y-1 border-t border-graphite/15 pt-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-primary">
              <input type="checkbox" checked={pf.canBrowse} onChange={(e) => setPf({ ...pf, canBrowse: e.target.checked })} />
              {L('يمكنه تصفح جميع عروضنا (للاطلاع فقط)', 'Can browse all our listings (view-only)')}
            </label>
            <p className="text-xs opacity-70">
              {L('يظهر فقط إذا كان الخيار العام مفعّلاً من صفحة الملاك.', 'Only takes effect when the global switch on the Owners page is on.')}
            </p>
          </div>
        </section>
      )}

      {/* Read-only server cards (listings / lands) */}
      {children}

      {/* Ad codes — deliberately the LAST editable card, right above the Save row. */}
      {draft.type !== 'PERSONAL' && (
        <section className={card}>
          <h2 className={h2}>{t('ownerCodes')}</h2>
          <OwnerCodesPicker draft={draft} setDraft={setDraft} taken={taken} heading={false} />
        </section>
      )}

      {error && <p className="text-sm text-red-600">{errMsg(error)}</p>}

      {/* ONE Save + Reset for the whole page; Delete stays an instant action. */}
      <div className="flex flex-wrap items-center gap-2">
        <button disabled={pending} onClick={save} className="rounded-md bg-primary px-6 py-2.5 text-sm font-bold text-soft disabled:opacity-50">
          {pending ? L('جارٍ الحفظ…', 'Saving…') : t('save')}
        </button>
        <button disabled={pending} onClick={reset} className="rounded-md border border-graphite/25 px-4 py-2.5 text-sm font-semibold hover:bg-graphite/10 disabled:opacity-50">
          {L('إعادة تعيين', 'Reset')}
        </button>
        <span className="flex-1" />
        <button disabled={pending} onClick={del} className="rounded-md border border-red-300 px-4 py-2.5 text-sm text-red-600 disabled:opacity-50">
          {t('delete')}
        </button>
      </div>
    </div>
  );
}
