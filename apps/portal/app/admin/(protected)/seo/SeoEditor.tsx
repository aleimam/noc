'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@noc/ui';
import type { SeoIntroValue } from '../../../../lib/seoContent';
import { saveSeoIntro, saveSocialLinks } from './actions';

const ta = 'w-full rounded-md border border-graphite/20 bg-transparent px-3 py-2 text-sm';

type IntroItem = { pageKey: string; labelAr: string; labelEn: string; value: SeoIntroValue };

export function SeoEditor({
  intros,
  socialNewobour,
  socialAlsawarey,
  locale,
}: {
  intros: IntroItem[];
  socialNewobour: string;
  socialAlsawarey: string;
  locale: 'ar' | 'en';
}) {
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-primary">{L('فقرات تعريفية للصفحات', 'Page intro paragraphs')}</h2>
          <p className="text-sm opacity-70">
            {L(
              'فقرة قصيرة (اختيارية) تظهر أعلى الصفحة العامة أسفل العنوان لتحسين الظهور في محركات البحث. نص عادي فقط.',
              'A short optional paragraph shown at the top of each public page (below the H1) to improve search visibility. Plain text only.',
            )}
          </p>
        </div>
        {intros.map((it) => (
          <IntroCard key={it.pageKey} item={it} locale={locale} />
        ))}
      </section>

      <SocialCard initialNewobour={socialNewobour} initialAlsawarey={socialAlsawarey} locale={locale} />
    </div>
  );
}

function IntroCard({ item, locale }: { item: IntroItem; locale: 'ar' | 'en' }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [ar, setAr] = useState(item.value.ar);
  const [en, setEn] = useState(item.value.en);
  const [saved, setSaved] = useState(false);
  const L = (a: string, e: string) => (locale === 'ar' ? a : e);

  function save() {
    setSaved(false);
    start(async () => {
      const r = await saveSeoIntro(item.pageKey, { ar, en });
      if (r.ok) {
        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 2500);
      } else toast(L('تعذّر الحفظ', 'Save failed'), 'error');
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-graphite/15 p-4">
      <h3 className="font-semibold text-primary">{L(item.labelAr, item.labelEn)}</h3>
      <label className="block text-sm">
        {L('النص (عربي)', 'Text (Arabic)')}
        <textarea dir="rtl" value={ar} onChange={(e) => setAr(e.target.value)} rows={3} className={ta} />
      </label>
      <label className="block text-sm">
        {L('النص (إنجليزي)', 'Text (English)')}
        <textarea dir="ltr" value={en} onChange={(e) => setEn(e.target.value)} rows={3} className={ta} />
      </label>
      <div className="flex items-center gap-3">
        <button disabled={pending} onClick={save} className="rounded-md bg-primary px-5 py-2 text-sm text-soft disabled:opacity-50">
          {pending ? L('جارٍ الحفظ…', 'Saving…') : L('حفظ', 'Save')}
        </button>
        {saved && <span className="text-sm text-green">{L('تم الحفظ ✓', 'Saved ✓')}</span>}
      </div>
    </div>
  );
}

function SocialCard({ initialNewobour, initialAlsawarey, locale }: { initialNewobour: string; initialAlsawarey: string; locale: 'ar' | 'en' }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [nob, setNob] = useState(initialNewobour);
  const [als, setAls] = useState(initialAlsawarey);
  const [saved, setSaved] = useState(false);
  const L = (a: string, e: string) => (locale === 'ar' ? a : e);

  function save() {
    setSaved(false);
    start(async () => {
      const [r1, r2] = await Promise.all([saveSocialLinks('newobour', nob), saveSocialLinks('alsawarey', als)]);
      if (r1.ok && r2.ok) {
        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 2500);
      } else toast(L('تعذّر الحفظ', 'Save failed'), 'error');
    });
  }

  return (
    <section className="space-y-3 rounded-lg border border-graphite/15 p-4">
      <div>
        <h2 className="text-lg font-bold text-primary">{L('روابط التواصل الاجتماعي', 'Social profile links')}</h2>
        <p className="text-sm opacity-70">
          {L(
            'رابط لكل سطر (فيسبوك، إنستجرام، يوتيوب…). تُستخدم كإشارة هوية (sameAs) لمحركات البحث والذكاء الاصطناعي.',
            'One profile URL per line (Facebook, Instagram, YouTube…). Emitted as the sameAs entity signal for search engines and AI.',
          )}
        </p>
      </div>
      <label className="block text-sm">
        {L('العبور الجديدة (newobour.com)', 'New Obour (newobour.com)')}
        <textarea dir="ltr" value={nob} onChange={(e) => setNob(e.target.value)} rows={4} className={ta} placeholder="https://facebook.com/…" />
      </label>
      <label className="block text-sm">
        {L('الصواري (alsawarey.com)', 'Al Sawarey (alsawarey.com)')}
        <textarea dir="ltr" value={als} onChange={(e) => setAls(e.target.value)} rows={4} className={ta} placeholder="https://facebook.com/…" />
      </label>
      <div className="flex items-center gap-3">
        <button disabled={pending} onClick={save} className="rounded-md bg-primary px-5 py-2 text-sm text-soft disabled:opacity-50">
          {pending ? L('جارٍ الحفظ…', 'Saving…') : L('حفظ', 'Save')}
        </button>
        {saved && <span className="text-sm text-green">{L('تم الحفظ ✓', 'Saved ✓')}</span>}
      </div>
    </section>
  );
}
