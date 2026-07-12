'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
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
};
const inp = 'w-full rounded-md border border-graphite/20 bg-transparent px-3 py-2 text-sm';

function OnOff({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex gap-2">
      <button type="button" onClick={() => onChange(true)} className={`rounded-md px-4 py-2 text-sm ${on ? 'bg-primary text-soft' : 'border border-graphite/20'}`}>مفعّل / On</button>
      <button type="button" onClick={() => onChange(false)} className={`rounded-md px-4 py-2 text-sm ${!on ? 'bg-primary text-soft' : 'border border-graphite/20'}`}>متوقف / Off</button>
    </div>
  );
}

export function SiteSettingsClient({ initial }: { initial: Initial }) {
  const router = useRouter();
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
      });
      if (r.ok) {
        setSaved(true);
        router.refresh();
      } else {
        toast('تعذّر الحفظ / Save failed', 'error');
      }
    });
  }

  return (
    <div className="space-y-5">
      <section className="space-y-3 rounded-lg border border-graphite/15 p-4">
        <h2 className="font-semibold text-primary">قائمة الجوال (العبور الجديدة)</h2>
        <div className="flex gap-2">
          {(['full', 'compact'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setS((x) => ({ ...x, mobileMenu: m }))}
              className={`rounded-md px-4 py-2 text-sm ${s.mobileMenu === m ? 'bg-primary text-soft' : 'border border-graphite/20'}`}
            >
              {m === 'full' ? 'شاشة كاملة (أزرار كبيرة)' : 'قائمة صغيرة منسدلة'}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-graphite/15 p-4">
        <h2 className="font-semibold text-primary">شعار الموقع (السطر التعريفي) — العبور الجديدة</h2>
        <label className="block text-sm">بالعربية<input value={s.sloganNewobour} onChange={(e) => setS((x) => ({ ...x, sloganNewobour: e.target.value }))} className={inp} /></label>
        <label className="block text-sm">English<input dir="ltr" value={s.sloganNewobourEn} onChange={(e) => setS((x) => ({ ...x, sloganNewobourEn: e.target.value }))} className={inp} /></label>
        <p className="text-xs opacity-60">شعار الصواري (alsawarey.com) يُحرَّر من «واجهة موقع الصواري» ← سطر التذييل.</p>
      </section>

      <section className="space-y-3 rounded-lg border border-graphite/15 p-4">
        <h2 className="font-semibold text-primary">حقوق النشر (التذييل)</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">العبور الجديدة — بالعربية<input value={s.copyrightNewobour} onChange={(e) => setS((x) => ({ ...x, copyrightNewobour: e.target.value }))} className={inp} /></label>
          <label className="block text-sm">New Obour — English<input dir="ltr" value={s.copyrightNewobourEn} onChange={(e) => setS((x) => ({ ...x, copyrightNewobourEn: e.target.value }))} className={inp} /></label>
          <label className="block text-sm">الصواري — بالعربية<input value={s.copyrightAlsawarey} onChange={(e) => setS((x) => ({ ...x, copyrightAlsawarey: e.target.value }))} className={inp} /></label>
          <label className="block text-sm">Al Sawarey — English<input dir="ltr" value={s.copyrightAlsawareyEn} onChange={(e) => setS((x) => ({ ...x, copyrightAlsawareyEn: e.target.value }))} className={inp} /></label>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-graphite/15 p-4">
        <h2 className="font-semibold text-primary">واتساب المساعدة (صفحات التقنين)</h2>
        <p className="text-xs opacity-60">يظهر زر «محتاج مساعدة؟ كلمنا» للزوّار. اتركه فارغاً لإخفاء الزر.</p>
        <input dir="ltr" value={s.whatsappHelp} onChange={(e) => setS((x) => ({ ...x, whatsappHelp: e.target.value }))} className={inp} placeholder="+201XXXXXXXXX" />
      </section>

      <section className="space-y-3 rounded-lg border border-graphite/15 p-4">
        <h2 className="font-semibold text-primary">زر واتساب عائم — العبور الجديدة / Floating WhatsApp</h2>
        <p className="text-xs opacity-60">زر واتساب دائري يظهر في كل صفحات العبور الجديدة. يستخدم «رقم واتساب المساعدة» أعلاه — لو الرقم فارغ لن يظهر الزر.</p>
        <OnOff on={s.whatsappFloatNewobour} onChange={(v) => setS((x) => ({ ...x, whatsappFloatNewobour: v }))} />
        <label className="block text-sm">رسالة مبدئية (اختياري) / Prefilled message
          <input value={s.whatsappFloatMsgNewobour} onChange={(e) => setS((x) => ({ ...x, whatsappFloatMsgNewobour: e.target.value }))} className={inp} placeholder="مرحباً، لدي استفسار" />
        </label>
      </section>

      <section className="space-y-3 rounded-lg border border-graphite/15 p-4">
        <h2 className="font-semibold text-primary">زر واتساب عائم — الصواري / Floating WhatsApp</h2>
        <p className="text-xs opacity-60">زر واتساب دائري يظهر في كل صفحات الصواري (alsawarey.com). يستخدم رقم واتساب المُدخل في «واجهة موقع الصواري» — لو الرقم فارغ لن يظهر الزر.</p>
        <OnOff on={s.whatsappFloatAlsawarey} onChange={(v) => setS((x) => ({ ...x, whatsappFloatAlsawarey: v }))} />
        <label className="block text-sm">رسالة مبدئية (اختياري) / Prefilled message
          <input value={s.whatsappFloatMsgAlsawarey} onChange={(e) => setS((x) => ({ ...x, whatsappFloatMsgAlsawarey: e.target.value }))} className={inp} placeholder="مرحباً، لدي استفسار" />
        </label>
      </section>

      <div className="flex items-center gap-3">
        <button disabled={pending} onClick={save} className="rounded-md bg-primary px-6 py-2.5 text-sm text-soft disabled:opacity-50">{pending ? 'جارٍ الحفظ…' : 'حفظ'}</button>
        {saved && <span className="text-sm text-green">تم الحفظ ✓</span>}
      </div>
    </div>
  );
}
