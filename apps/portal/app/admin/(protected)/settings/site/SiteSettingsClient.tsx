'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { toast } from '@noc/ui';
import { saveSiteSettings } from './actions';

type Initial = {
  mobileMenu: string;
  sloganNewobour: string;
  sloganNewobourEn: string;
  copyrightNewobour: string;
  copyrightNewobourEn: string;
  copyrightAlsawarey: string;
  copyrightAlsawareyEn: string;
  whatsappHelp: string;
  whatsappFloatNewobour: boolean;
  whatsappFloatMsgNewobour: string;
  whatsappFloatAlsawarey: boolean;
  whatsappFloatMsgAlsawarey: string;
  galleryPhotoAnalytics: boolean;
};
const inp = 'w-full rounded-md border border-graphite/20 bg-transparent px-3 py-2 text-sm';

function OnOff({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  const locale = useLocale() as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  return (
    <div className="flex gap-2">
      <button type="button" onClick={() => onChange(true)} className={`rounded-md px-4 py-2 text-sm ${on ? 'bg-primary text-soft' : 'border border-graphite/20'}`}>{L('مفعّل', 'On')}</button>
      <button type="button" onClick={() => onChange(false)} className={`rounded-md px-4 py-2 text-sm ${!on ? 'bg-primary text-soft' : 'border border-graphite/20'}`}>{L('متوقف', 'Off')}</button>
    </div>
  );
}

export function SiteSettingsClient({ initial }: { initial: Initial }) {
  const router = useRouter();
  const locale = useLocale() as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const [s, setS] = useState(initial);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  function save() {
    setSaved(false);
    start(async () => {
      const r = await saveSiteSettings({
        'site.mobileMenu': s.mobileMenu,
        'site.slogan': s.sloganNewobour,
        'site.slogan_en': s.sloganNewobourEn,
        copyright_newobour: s.copyrightNewobour,
        copyright_newobour_en: s.copyrightNewobourEn,
        copyright_alsawarey: s.copyrightAlsawarey,
        copyright_alsawarey_en: s.copyrightAlsawareyEn,
        'site.whatsappHelp': s.whatsappHelp,
        whatsapp_float_newobour: s.whatsappFloatNewobour ? '1' : '0',
        whatsapp_float_msg_newobour: s.whatsappFloatMsgNewobour,
        whatsapp_float_alsawarey: s.whatsappFloatAlsawarey ? '1' : '0',
        whatsapp_float_msg_alsawarey: s.whatsappFloatMsgAlsawarey,
        'gallery.photoAnalytics': s.galleryPhotoAnalytics ? '1' : '0',
      });
      if (r.ok) {
        setSaved(true);
        router.refresh();
      } else {
        toast(L('تعذّر الحفظ', 'Save failed'), 'error');
      }
    });
  }

  return (
    <div className="space-y-5">
      <section className="space-y-3 rounded-lg border border-graphite/15 p-4">
        <h2 className="font-semibold text-primary">{L('قائمة الجوال (العبور الجديدة)', 'Mobile menu (New Obour)')}</h2>
        <div className="flex gap-2">
          {(['full', 'compact'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setS((x) => ({ ...x, mobileMenu: m }))}
              className={`rounded-md px-4 py-2 text-sm ${s.mobileMenu === m ? 'bg-primary text-soft' : 'border border-graphite/20'}`}
            >
              {m === 'full' ? L('شاشة كاملة (أزرار كبيرة)', 'Full screen (large buttons)') : L('قائمة صغيرة منسدلة', 'Small dropdown menu')}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-graphite/15 p-4">
        <h2 className="font-semibold text-primary">{L('شعار الموقع (السطر التعريفي) — العبور الجديدة', 'Site slogan (tagline) — New Obour')}</h2>
        <label className="block text-sm">{L('بالعربية', 'Arabic')}<input value={s.sloganNewobour} onChange={(e) => setS((x) => ({ ...x, sloganNewobour: e.target.value }))} className={inp} /></label>
        <label className="block text-sm">English<input dir="ltr" value={s.sloganNewobourEn} onChange={(e) => setS((x) => ({ ...x, sloganNewobourEn: e.target.value }))} className={inp} /></label>
        <p className="text-xs opacity-60">{L('شعار الصواري (alsawarey.com) يُحرَّر من «واجهة موقع الصواري» ← سطر التذييل.', 'The Al Sawarey slogan (alsawarey.com) is edited under “Al Sawarey storefront” → footer line.')}</p>
      </section>

      <section className="space-y-3 rounded-lg border border-graphite/15 p-4">
        <h2 className="font-semibold text-primary">{L('حقوق النشر (التذييل)', 'Copyright (footer)')}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">{L('العبور الجديدة — بالعربية', 'New Obour — Arabic')}<input value={s.copyrightNewobour} onChange={(e) => setS((x) => ({ ...x, copyrightNewobour: e.target.value }))} className={inp} /></label>
          <label className="block text-sm">New Obour — English<input dir="ltr" value={s.copyrightNewobourEn} onChange={(e) => setS((x) => ({ ...x, copyrightNewobourEn: e.target.value }))} className={inp} /></label>
          <label className="block text-sm">{L('الصواري — بالعربية', 'Al Sawarey — Arabic')}<input value={s.copyrightAlsawarey} onChange={(e) => setS((x) => ({ ...x, copyrightAlsawarey: e.target.value }))} className={inp} /></label>
          <label className="block text-sm">Al Sawarey — English<input dir="ltr" value={s.copyrightAlsawareyEn} onChange={(e) => setS((x) => ({ ...x, copyrightAlsawareyEn: e.target.value }))} className={inp} /></label>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-graphite/15 p-4">
        <h2 className="font-semibold text-primary">{L('واتساب المساعدة (صفحات التقنين)', 'Help WhatsApp (rationing pages)')}</h2>
        <p className="text-xs opacity-60">{L('يظهر زر «محتاج مساعدة؟ كلمنا» للزوّار. اتركه فارغاً لإخفاء الزر.', 'Shows a “Need help? Talk to us” button to visitors. Leave it empty to hide the button.')}</p>
        <input dir="ltr" value={s.whatsappHelp} onChange={(e) => setS((x) => ({ ...x, whatsappHelp: e.target.value }))} className={inp} placeholder="+201XXXXXXXXX" />
      </section>

      <section className="space-y-3 rounded-lg border border-graphite/15 p-4">
        <h2 className="font-semibold text-primary">{L('زر واتساب عائم — العبور الجديدة', 'Floating WhatsApp — New Obour')}</h2>
        <p className="text-xs opacity-60">{L('زر واتساب دائري يظهر في كل صفحات العبور الجديدة. يستخدم «رقم واتساب المساعدة» أعلاه — لو الرقم فارغ لن يظهر الزر.', 'A round WhatsApp button on every New Obour page. It uses the “help WhatsApp number” above — if that number is empty the button will not appear.')}</p>
        <OnOff on={s.whatsappFloatNewobour} onChange={(v) => setS((x) => ({ ...x, whatsappFloatNewobour: v }))} />
        <label className="block text-sm">{L('رسالة مبدئية (اختياري)', 'Prefilled message (optional)')}
          <input value={s.whatsappFloatMsgNewobour} onChange={(e) => setS((x) => ({ ...x, whatsappFloatMsgNewobour: e.target.value }))} className={inp} placeholder={L('مرحباً، لدي استفسار', 'Hello, I have a question')} />
        </label>
      </section>

      <section className="space-y-3 rounded-lg border border-graphite/15 p-4">
        <h2 className="font-semibold text-primary">{L('زر واتساب عائم — الصواري', 'Floating WhatsApp — Al Sawarey')}</h2>
        <p className="text-xs opacity-60">{L('زر واتساب دائري يظهر في كل صفحات الصواري (alsawarey.com). يستخدم رقم واتساب المُدخل في «واجهة موقع الصواري» — لو الرقم فارغ لن يظهر الزر.', 'A round WhatsApp button on every Al Sawarey page (alsawarey.com). It uses the WhatsApp number entered under “Al Sawarey storefront” — if that number is empty the button will not appear.')}</p>
        <OnOff on={s.whatsappFloatAlsawarey} onChange={(v) => setS((x) => ({ ...x, whatsappFloatAlsawarey: v }))} />
        <label className="block text-sm">{L('رسالة مبدئية (اختياري)', 'Prefilled message (optional)')}
          <input value={s.whatsappFloatMsgAlsawarey} onChange={(e) => setS((x) => ({ ...x, whatsappFloatMsgAlsawarey: e.target.value }))} className={inp} placeholder={L('مرحباً، لدي استفسار', 'Hello, I have a question')} />
        </label>
      </section>

      <section className="space-y-3 rounded-lg border border-graphite/15 p-4">
        <h2 className="font-semibold text-primary">{L('معرض صور الإعلان', 'Listing photo gallery')}</h2>
        <div className="space-y-1">
          <p className="text-sm font-medium">{L('إحصاءات الصور', 'Photo analytics')}</p>
          <p className="text-xs opacity-60">{L('تسجيل فتح الصور والتنقّل بينها والتكبير والمشاركة (بدون بيانات شخصية) — تظهر «أكثر الصور مشاهدة» في لوحة تحليلات الزوّار.', 'Logs photo opens, navigation, zoom and sharing (no personal data) — “most-viewed photos” then appears in the visitor analytics dashboard.')}</p>
          <OnOff on={s.galleryPhotoAnalytics} onChange={(v) => setS((x) => ({ ...x, galleryPhotoAnalytics: v }))} />
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button disabled={pending} onClick={save} className="rounded-md bg-primary px-6 py-2.5 text-sm text-soft disabled:opacity-50">{pending ? L('جارٍ الحفظ…', 'Saving…') : L('حفظ', 'Save')}</button>
        {saved && <span className="text-sm text-green">{L('تم الحفظ ✓', 'Saved ✓')}</span>}
      </div>
    </div>
  );
}
