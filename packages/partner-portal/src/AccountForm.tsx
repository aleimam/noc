'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast, PasswordInput } from '@noc/ui';
import {
  partnerUpdateAccount,
  partnerRequestIdentifierChange,
  partnerConfirmIdentifierChange,
  partnerClearIdentifier,
} from './actions';

const inp = 'w-full rounded-md border border-graphite/20 bg-transparent px-3 py-3 text-base';

/** Map a server error code to a localized message (shared by every action here). */
function errText(code: string, L: (ar: string, en: string) => string): string {
  switch (code) {
    case 'identifier_required': return L('أبقِ وسيلة دخول واحدة على الأقل', 'Keep at least one login identifier');
    case 'invalid_phone': return L('رقم الهاتف غير صالح', 'Invalid phone');
    case 'invalid_email': return L('البريد الإلكتروني غير صالح', 'Invalid email');
    case 'duplicate_key': return L('هذا البريد / الهاتف مستخدم بالفعل', 'That email / phone is already in use');
    case 'bad_code': return L('الرمز غير صحيح أو منتهي', 'The code is wrong or expired');
    case 'cooldown': return L('انتظر قليلاً قبل إعادة الإرسال', 'Please wait before requesting another code');
    case 'rate_limited': return L('محاولات كثيرة — حاول لاحقاً', 'Too many attempts — try again later');
    default: return L('تعذّر الحفظ', 'Save failed');
  }
}

/** One email/phone row with a verify-before-commit flow: type the new value → «أرسل الرمز» sends
 *  an OTP to THAT destination → enter the code → «تأكيد» commits it. A destination can never
 *  become a login route without proving control of it first. */
function IdentifierEditor({
  field,
  current,
  locale,
  onChanged,
}: {
  field: 'email' | 'phone';
  current: string;
  locale: 'ar' | 'en';
  onChanged: () => void;
}) {
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');

  const label = field === 'email' ? L('البريد الإلكتروني', 'Email') : L('الهاتف (يستقبل رمز الدخول)', 'Phone (receives the login code)');
  const type = field === 'email' ? 'email' : 'tel';

  function reset() {
    setOpen(false); setSent(false); setValue(''); setCode('');
  }

  function send() {
    start(async () => {
      const r = await partnerRequestIdentifierChange({ field, value, locale });
      if (r.ok) { setSent(true); toast(L('أرسلنا رمز تحقق إلى الوجهة الجديدة', 'We sent a verification code to the new destination')); }
      else toast(errText(r.error, L), 'error');
    });
  }

  function submitCode() {
    start(async () => {
      const r = await partnerConfirmIdentifierChange({ field, value, code });
      if (r.ok) { toast(L('تم التحديث', 'Updated')); reset(); onChanged(); }
      else toast(errText(r.error, L), 'error');
    });
  }

  function clear() {
    if (!window.confirm(L('هل تريد إزالة وسيلة الدخول هذه؟', 'Remove this login route?'))) return;
    start(async () => {
      const r = await partnerClearIdentifier({ field });
      if (r.ok) { toast(L('تمت الإزالة', 'Removed')); reset(); onChanged(); }
      else toast(errText(r.error, L), 'error');
    });
  }

  return (
    <div className="rounded-md border border-graphite/15 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold">{label}</div>
          <div dir="ltr" className="truncate text-sm text-ink-500">{current || L('— غير محدد', '— not set')}</div>
        </div>
        {!open && (
          <div className="flex shrink-0 gap-2">
            <button onClick={() => setOpen(true)} className="min-h-10 rounded-md border border-graphite/25 px-3 text-sm font-bold">
              {current ? L('تغيير', 'Change') : L('إضافة', 'Add')}
            </button>
            {current && (
              <button onClick={clear} disabled={pending} className="min-h-10 rounded-md px-3 text-sm font-bold text-red-600 disabled:opacity-50">
                {L('إزالة', 'Remove')}
              </button>
            )}
          </div>
        )}
      </div>

      {open && (
        <div className="mt-3 space-y-2">
          <input
            dir="ltr"
            type={type}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={sent}
            placeholder={field === 'email' ? 'name@example.com' : '01xxxxxxxxx'}
            className={`${inp} disabled:opacity-60`}
          />
          {!sent ? (
            <div className="flex gap-2">
              <button onClick={send} disabled={pending || !value.trim()} className="min-h-10 rounded-md bg-primary px-4 text-sm font-bold text-soft disabled:opacity-50">
                {pending ? L('جارٍ الإرسال…', 'Sending…') : L('أرسل رمز التحقق', 'Send code')}
              </button>
              <button onClick={reset} className="min-h-10 rounded-md px-3 text-sm text-ink-500">{L('إلغاء', 'Cancel')}</button>
            </div>
          ) : (
            <>
              <input
                dir="ltr"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={L('رمز التحقق', 'Verification code')}
                className={inp}
              />
              <div className="flex gap-2">
                <button onClick={submitCode} disabled={pending || !code.trim()} className="min-h-10 rounded-md bg-primary px-4 text-sm font-bold text-soft disabled:opacity-50">
                  {pending ? L('جارٍ التأكيد…', 'Confirming…') : L('تأكيد', 'Confirm')}
                </button>
                <button onClick={send} disabled={pending} className="min-h-10 rounded-md border border-graphite/25 px-3 text-sm font-bold disabled:opacity-50">
                  {L('إعادة الإرسال', 'Resend')}
                </button>
                <button onClick={reset} className="min-h-10 rounded-md px-3 text-sm text-ink-500">{L('إلغاء', 'Cancel')}</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

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
  const [username, setUsername] = useState(initial.username);
  const [password, setPassword] = useState('');

  function save() {
    start(async () => {
      const r = await partnerUpdateAccount({ username, password });
      if (r.ok) {
        toast(L('تم حفظ الحساب', 'Account saved'));
        setPassword('');
        router.refresh();
      } else {
        toast(errText(r.error, L), 'error');
      }
    });
  }

  return (
    <div className="max-w-lg space-y-4 rounded-lg border border-ink-200 bg-white p-6 shadow-sm">
      <label className="block text-sm font-semibold">
        {L('اسم المستخدم', 'Username')}
        <input dir="ltr" value={username} onChange={(e) => setUsername(e.target.value)} className={`${inp} mt-1`} />
      </label>

      <label className="block text-sm font-semibold">
        {L('كلمة مرور جديدة', 'New password')}
        <span className="mt-1 block">
          <PasswordInput
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            locale={locale}
            placeholder={initial.hasPassword ? L('اتركها فارغة للإبقاء على كلمة المرور الحالية', 'Leave empty to keep your current password') : L('اختياري — يمكنك الدخول برمز يصلك على الهاتف', 'Optional — you can also log in with an SMS code')}
            className={inp}
          />
        </span>
        <span className="mt-1 block text-xs font-normal text-ink-500">
          {L('اكتب كلمة مرور جديدة واضغط على العين 👁 للتأكد منها. لا يمكن عرض كلمة المرور الحالية لأنها محفوظة مشفّرة.',
             'Type a new password and tap the eye 👁 to confirm it. The current password can’t be displayed — it’s stored encrypted.')}
        </span>
      </label>

      <button onClick={save} disabled={pending} className="w-full rounded-lg bg-primary px-4 py-3 text-base font-bold text-soft disabled:opacity-50">
        {pending ? L('جارٍ الحفظ…', 'Saving…') : L('حفظ اسم المستخدم / كلمة المرور', 'Save username / password')}
      </button>

      <div className="space-y-3 border-t border-ink-100 pt-4">
        <div className="text-sm font-bold text-ink-600">{L('وسائل الدخول', 'Login routes')}</div>
        <p className="text-xs text-ink-500">
          {L('تغيير البريد أو الهاتف يتطلب إدخال رمز تحقق يصل إلى الوجهة الجديدة — لحماية حسابك.',
             'Changing your email or phone requires a code sent to the new destination — to protect your account.')}
        </p>
        <IdentifierEditor field="email" current={initial.email} locale={locale} onChanged={() => router.refresh()} />
        <IdentifierEditor field="phone" current={initial.phone} locale={locale} onChanged={() => router.refresh()} />
      </div>
    </div>
  );
}
