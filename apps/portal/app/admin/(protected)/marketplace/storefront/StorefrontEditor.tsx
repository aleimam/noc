'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@noc/ui';
import type { Loc, StoreLink, StoreSectionKey, StorefrontContent } from '@noc/config';
import { saveStorefront } from './actions';

const inp = 'w-full rounded-md border border-graphite/20 bg-transparent px-3 py-2 text-sm';

const SECTION_NAMES: Record<StoreSectionKey, string> = {
  quickFilters: 'الفلاتر السريعة',
  featured: 'عروض مميزة',
  latest: 'أحدث الأراضي',
  sellBand: 'شريط «بيع أرضك»',
  sold: 'تم بيعها مؤخراً',
};

export function StorefrontEditor({ initial }: { initial: StorefrontContent }) {
  const router = useRouter();
  const [c, setC] = useState<StorefrontContent>(initial);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  // immutable update via structured clone
  const up = (fn: (n: StorefrontContent) => void) =>
    setC((prev) => {
      const n = structuredClone(prev);
      fn(n);
      return n;
    });

  function save() {
    setSaved(false);
    start(async () => {
      const r = await saveStorefront(c);
      if (r.ok) {
        setSaved(true);
        router.refresh();
      } else {
        toast('تعذّر الحفظ / Save failed', 'error');
      }
    });
  }

  function move(i: number, dir: -1 | 1) {
    up((n) => {
      const j = i + dir;
      if (j < 0 || j >= n.sections.length) return;
      const a = n.sections;
      [a[i], a[j]] = [a[j]!, a[i]!];
    });
  }

  return (
    <div className="space-y-5">
      {/* HERO */}
      <Card title="الواجهة (Hero)">
        <Loc2 label="العنوان الرئيسي" val={c.hero.title} onChange={(v) => up((n) => { n.hero.title = v; })} />
        <Loc2 label="العنوان الفرعي" val={c.hero.subtitle} onChange={(v) => up((n) => { n.hero.subtitle = v; })} multiline />
        <Toggle label="إظهار شريط البحث" checked={c.hero.showSearch} onChange={(v) => up((n) => { n.hero.showSearch = v; })} />
        <Loc2 label="نص شريط البحث" val={c.hero.searchPlaceholder} onChange={(v) => up((n) => { n.hero.searchPlaceholder = v; })} />
        <div className="grid gap-3 sm:grid-cols-2">
          <LinkBox label="الزر الأساسي" val={c.hero.primaryCta} onChange={(v) => up((n) => { n.hero.primaryCta = v; })} />
          <LinkBox label="الزر الثانوي" val={c.hero.secondaryCta} onChange={(v) => up((n) => { n.hero.secondaryCta = v; })} />
        </div>
        <div className="rounded-md border border-graphite/15 p-3">
          <Toggle label="إظهار شريط الإحصائيات" checked={c.hero.stats.show} onChange={(v) => up((n) => { n.hero.stats.show = v; })} />
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <Loc2 label="وصف عدد الأراضي المتاحة" val={c.hero.stats.availableLabel} onChange={(v) => up((n) => { n.hero.stats.availableLabel = v; })} />
            <Loc2 label="وصف عدد المباعة" val={c.hero.stats.soldLabel} onChange={(v) => up((n) => { n.hero.stats.soldLabel = v; })} />
            <Loc2 label="قيمة الإحصائية الإضافية" val={c.hero.stats.extraValue} onChange={(v) => up((n) => { n.hero.stats.extraValue = v; })} />
            <Loc2 label="وصف الإحصائية الإضافية" val={c.hero.stats.extraLabel} onChange={(v) => up((n) => { n.hero.stats.extraLabel = v; })} />
          </div>
        </div>
        <p className="text-xs opacity-60">صورة خلفية الواجهة تُرفع من «الشعارات والهوية».</p>
      </Card>

      {/* SECTIONS ORDER + VISIBILITY */}
      <Card title="الأقسام — الترتيب والظهور">
        <div className="divide-y divide-graphite/10 rounded-md border border-graphite/15">
          {c.sections.map((s, i) => (
            <div key={s.key} className="space-y-2 p-3">
              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={s.enabled} onChange={(e) => up((n) => { n.sections[i]!.enabled = e.target.checked; })} className="h-4 w-4" />
                  {SECTION_NAMES[s.key]}
                </label>
                <div className="flex gap-1">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded border border-graphite/20 px-2 text-sm disabled:opacity-30">↑</button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === c.sections.length - 1} className="rounded border border-graphite/20 px-2 text-sm disabled:opacity-30">↓</button>
                </div>
              </div>
              {(s.key === 'featured' || s.key === 'latest' || s.key === 'sold') && (
                <Loc2 label="عنوان القسم" val={c.titles[s.key]} onChange={(v) => up((n) => { n.titles[s.key as 'featured' | 'latest' | 'sold'] = v; })} />
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* SELL BAND */}
      <Card title="شريط «بيع أرضك»">
        <Loc2 label="العنوان" val={c.sellBand.title} onChange={(v) => up((n) => { n.sellBand.title = v; })} />
        <Loc2 label="النص" val={c.sellBand.body} onChange={(v) => up((n) => { n.sellBand.body = v; })} multiline />
        <LinkBox label="زر الشريط" val={c.sellBand.cta} onChange={(v) => up((n) => { n.sellBand.cta = v; })} />
      </Card>

      {/* FEATURE PILLS */}
      <Card title="الفلاتر السريعة (أزرار المميزات)">
        <LinkList
          items={c.featurePills}
          onChange={(i, v) => up((n) => { n.featurePills[i] = v; })}
          onRemove={(i) => up((n) => { n.featurePills.splice(i, 1); })}
          onAdd={() => up((n) => { n.featurePills.push({ label: { ar: '', en: '' }, href: '/listings' }); })}
        />
      </Card>

      {/* AREA CHIPS */}
      <Card title="أزرار المساحات (Chips)">
        <LinkList
          items={c.areaChips}
          onChange={(i, v) => up((n) => { n.areaChips[i] = v; })}
          onRemove={(i) => up((n) => { n.areaChips.splice(i, 1); })}
          onAdd={() => up((n) => { n.areaChips.push({ label: { ar: '', en: '' }, href: '/listings?area=' }); })}
        />
      </Card>

      {/* PRICE CHIPS */}
      <Card title="أزرار الأسعار (Chips)">
        <LinkList
          items={c.priceChips}
          onChange={(i, v) => up((n) => { n.priceChips[i] = v; })}
          onRemove={(i) => up((n) => { n.priceChips.splice(i, 1); })}
          onAdd={() => up((n) => { n.priceChips.push({ label: { ar: '', en: '' }, href: '/listings?priceMax=' }); })}
        />
        <p className="text-xs opacity-50">مثال: ‎/listings?priceMax=1000000‎ أو ‎/listings?priceMin=1000000&priceMax=2000000‎ أو ‎/listings?sort=price_asc‎</p>
      </Card>

      {/* NAV */}
      <Card title="القائمة العلوية">
        <div className="grid gap-3 sm:grid-cols-3">
          <LinkBox label="كل الأراضي" val={c.nav.allLands} onChange={(v) => up((n) => { n.nav.allLands = v; })} />
          <LinkBox label="مميز" val={c.nav.featured} onChange={(v) => up((n) => { n.nav.featured = v; })} />
          <LinkBox label="بيع أرضك" val={c.nav.sell} onChange={(v) => up((n) => { n.nav.sell = v; })} />
        </div>
        <div className="space-y-3">
          {c.nav.groups.map((g, gi) => (
            <div key={gi} className="rounded-md border border-graphite/15 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <Loc2 label="عنوان المجموعة" val={g.title} onChange={(v) => up((n) => { n.nav.groups[gi]!.title = v; })} />
                <button type="button" onClick={() => up((n) => { n.nav.groups.splice(gi, 1); })} className="ms-2 self-start rounded border border-graphite/20 px-2 py-1 text-xs text-red-600">حذف المجموعة</button>
              </div>
              <LinkList
                items={g.links}
                onChange={(li, v) => up((n) => { n.nav.groups[gi]!.links[li] = v; })}
                onRemove={(li) => up((n) => { n.nav.groups[gi]!.links.splice(li, 1); })}
                onAdd={() => up((n) => { n.nav.groups[gi]!.links.push({ label: { ar: '', en: '' }, href: '/listings' }); })}
              />
            </div>
          ))}
          <button type="button" onClick={() => up((n) => { n.nav.groups.push({ title: { ar: '', en: '' }, links: [] }); })} className="rounded-md border border-dashed border-graphite/30 px-3 py-1.5 text-xs text-accent">+ إضافة مجموعة</button>
        </div>
      </Card>

      {/* CONTACT + FOOTER */}
      <Card title="التواصل والتذييل">
        <label className="block text-sm">
          رقم واتساب التواصل
          <input dir="ltr" value={c.contact.whatsapp} onChange={(e) => up((n) => { n.contact.whatsapp = e.target.value; })} className={inp} placeholder="+201040810000" />
        </label>

        <div>
          <div className="mb-1 text-sm font-medium">أيقونات التواصل الاجتماعي (تظهر في التذييل)</div>
          <div className="space-y-2">
            {c.contact.socials.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <select value={s.platform} onChange={(e) => up((n) => { n.contact.socials[i]!.platform = e.target.value; })} className="rounded-md border border-graphite/20 bg-transparent px-2 py-2 text-sm">
                  {['facebook', 'instagram', 'whatsapp', 'youtube', 'tiktok', 'telegram', 'twitter', 'phone', 'email'].map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <input dir="ltr" value={s.url} onChange={(e) => up((n) => { n.contact.socials[i]!.url = e.target.value; })} className={inp} placeholder="https://…" />
                <button type="button" onClick={() => up((n) => { n.contact.socials.splice(i, 1); })} className="rounded border border-graphite/20 px-2 py-1 text-xs text-red-600">حذف</button>
              </div>
            ))}
            <button type="button" onClick={() => up((n) => { n.contact.socials.push({ platform: 'facebook', url: '' }); })} className="rounded-md border border-dashed border-graphite/30 px-3 py-1.5 text-xs text-accent">+ إضافة رابط</button>
          </div>
          <p className="mt-1 text-xs opacity-50">اترك الرابط فارغاً لإخفاء الأيقونة. الروابط الفارغة لا تظهر.</p>
        </div>

        <div className="rounded-md border border-graphite/15 p-3">
          <div className="mb-2 text-sm font-medium">التذييل (Footer)</div>
          <div className="space-y-3">
            <Loc2 label="اسم الموقع في التذييل" val={c.footer.name} onChange={(v) => up((n) => { n.footer.name = v; })} />
            <Loc2 label="الشعار / السطر التعريفي (يظهر تحت الاسم)" val={c.footer.slogan} onChange={(v) => up((n) => { n.footer.slogan = v; })} />
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <button disabled={pending} onClick={save} className="rounded-md bg-primary px-6 py-2.5 text-sm text-soft disabled:opacity-50">{pending ? 'جارٍ الحفظ…' : 'حفظ'}</button>
        {saved && <span className="text-sm text-green">تم الحفظ ✓</span>}
        <a href="https://alsawarey.com" target="_blank" rel="noreferrer" className="text-sm text-accent">معاينة الموقع ↗</a>
      </div>
    </div>
  );
}

/* ---------- reusable bits ---------- */

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border border-graphite/15 p-4">
      <h2 className="font-semibold text-primary">{title}</h2>
      {children}
    </section>
  );
}

function Loc2({ label, val, onChange, multiline }: { label: string; val: Loc; onChange: (v: Loc) => void; multiline?: boolean }) {
  return (
    <div className="text-sm">
      <div className="mb-1 text-xs opacity-70">{label}</div>
      <div className="grid gap-2 sm:grid-cols-2">
        {multiline ? (
          <>
            <textarea dir="rtl" rows={2} placeholder="عربي" value={val.ar} onChange={(e) => onChange({ ...val, ar: e.target.value })} className={inp} />
            <textarea dir="ltr" rows={2} placeholder="English" value={val.en} onChange={(e) => onChange({ ...val, en: e.target.value })} className={inp} />
          </>
        ) : (
          <>
            <input dir="rtl" placeholder="عربي" value={val.ar} onChange={(e) => onChange({ ...val, ar: e.target.value })} className={inp} />
            <input dir="ltr" placeholder="English" value={val.en} onChange={(e) => onChange({ ...val, en: e.target.value })} className={inp} />
          </>
        )}
      </div>
    </div>
  );
}

function LinkBox({ label, val, onChange }: { label: string; val: StoreLink; onChange: (v: StoreLink) => void }) {
  return (
    <div className="rounded-md border border-graphite/15 p-3">
      <Loc2 label={label} val={val.label} onChange={(l) => onChange({ ...val, label: l })} />
      <input dir="ltr" placeholder="/listings" value={val.href} onChange={(e) => onChange({ ...val, href: e.target.value })} className={`${inp} mt-2`} />
    </div>
  );
}

function LinkList({
  items,
  onChange,
  onRemove,
  onAdd,
}: {
  items: StoreLink[];
  onChange: (i: number, v: StoreLink) => void;
  onRemove: (i: number) => void;
  onAdd: () => void;
}) {
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="flex items-end gap-2">
          <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_1fr_1fr]">
            <input dir="rtl" placeholder="عربي" value={it.label.ar} onChange={(e) => onChange(i, { ...it, label: { ...it.label, ar: e.target.value } })} className={inp} />
            <input dir="ltr" placeholder="English" value={it.label.en} onChange={(e) => onChange(i, { ...it, label: { ...it.label, en: e.target.value } })} className={inp} />
            <input dir="ltr" placeholder="/listings?…" value={it.href} onChange={(e) => onChange(i, { ...it, href: e.target.value })} className={inp} />
          </div>
          <button type="button" onClick={() => onRemove(i)} className="rounded border border-graphite/20 px-2 py-2 text-xs text-red-600">حذف</button>
        </div>
      ))}
      <button type="button" onClick={onAdd} className="rounded-md border border-dashed border-graphite/30 px-3 py-1.5 text-xs text-accent">+ إضافة</button>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />
      {label}
    </label>
  );
}
