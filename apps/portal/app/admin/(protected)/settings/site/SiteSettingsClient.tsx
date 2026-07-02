'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveSiteSettings } from './actions';

type Initial = { mobileMenu: string; sloganNewobour: string; copyrightNewobour: string; copyrightAlsawarey: string; whatsappHelp: string };
const inp = 'w-full rounded-md border border-graphite/20 bg-transparent px-3 py-2 text-sm';

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
        copyright_newobour: s.copyrightNewobour,
        copyright_alsawarey: s.copyrightAlsawarey,
        'site.whatsappHelp': s.whatsappHelp,
      });
      if (r.ok) {
        setSaved(true);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-5">
      <section className="space-y-3 rounded-lg border border-graphite/15 p-4">
        <h2 className="font-semibold text-primary">قائمة الجوال (العبور الجديد)</h2>
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
        <h2 className="font-semibold text-primary">شعار الموقع (السطر التعريفي)</h2>
        <label className="block text-sm">العبور الجديد (newobour.com)<input value={s.sloganNewobour} onChange={(e) => setS((x) => ({ ...x, sloganNewobour: e.target.value }))} className={inp} /></label>
        <p className="text-xs opacity-60">شعار الصواري (alsawarey.com) يُحرَّر من «واجهة موقع الصواري» ← سطر التذييل.</p>
      </section>

      <section className="space-y-3 rounded-lg border border-graphite/15 p-4">
        <h2 className="font-semibold text-primary">حقوق النشر (التذييل)</h2>
        <label className="block text-sm">العبور الجديد (newobour.com)<input value={s.copyrightNewobour} onChange={(e) => setS((x) => ({ ...x, copyrightNewobour: e.target.value }))} className={inp} /></label>
        <label className="block text-sm">الصواري (alsawarey.com)<input value={s.copyrightAlsawarey} onChange={(e) => setS((x) => ({ ...x, copyrightAlsawarey: e.target.value }))} className={inp} /></label>
      </section>

      <section className="space-y-3 rounded-lg border border-graphite/15 p-4">
        <h2 className="font-semibold text-primary">واتساب المساعدة (صفحات التقنين)</h2>
        <p className="text-xs opacity-60">يظهر زر «محتاج مساعدة؟ كلمنا» للزوّار. اتركه فارغاً لإخفاء الزر.</p>
        <input dir="ltr" value={s.whatsappHelp} onChange={(e) => setS((x) => ({ ...x, whatsappHelp: e.target.value }))} className={inp} placeholder="+201XXXXXXXXX" />
      </section>

      <div className="flex items-center gap-3">
        <button disabled={pending} onClick={save} className="rounded-md bg-primary px-6 py-2.5 text-sm text-soft disabled:opacity-50">{pending ? 'جارٍ الحفظ…' : 'حفظ'}</button>
        {saved && <span className="text-sm text-green">تم الحفظ ✓</span>}
      </div>
    </div>
  );
}
