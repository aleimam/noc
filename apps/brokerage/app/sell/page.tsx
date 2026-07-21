import { getLocale } from 'next-intl/server';
import { prisma } from '@noc/db';
import { StoreShell } from '../_components/StoreShell';
import { getSellContent } from '../../lib/sellContent';
import { SellForm } from './SellForm';

export const dynamic = 'force-dynamic';

function Reqs({ title, groups }: { title: string; groups: { heading: string; items: string[] }[] }) {
  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-5">
      <h3 className="mb-3 font-bold text-navy-800">{title}</h3>
      <div className="grid gap-4 sm:grid-cols-3">
        {groups.map((g) => (
          <div key={g.heading}>
            <div className="mb-1 text-sm font-bold text-gold-700">{g.heading}</div>
            <ul className="space-y-1 text-sm text-ink-600">
              {g.items.map((i) => <li key={i}>• {i}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function SellPage() {
  // The page was hard-coded Arabic end to end, so an English visitor got English chrome wrapped
  // around an Arabic page — headings AND every city/district/neighborhood option. (The
  // admin-entered body copy still falls back to Arabic until its EN fields are filled in; that's
  // the owner's deferred content-entry task, not a code gap.)
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const [content, cityRows, districtRows, hoodRows] = await Promise.all([
    getSellContent(),
    prisma.rationingCity.findMany({ where: { isActive: true }, orderBy: [{ order: 'asc' }, { name: 'asc' }], select: { id: true, name: true, nameEn: true } }),
    prisma.district.findMany({ where: { isActive: true }, orderBy: [{ order: 'asc' }, { nameAr: 'asc' }], select: { id: true, nameAr: true, nameEn: true } }),
    prisma.neighborhood.findMany({ where: { isActive: true }, orderBy: [{ order: 'asc' }, { nameAr: 'asc' }], select: { id: true, nameAr: true, nameEn: true, districtId: true } }),
  ]);

  // Offers are limited to New Obour City for now — restrict the city list to it (fallback: all).
  // Geo names fall back to Arabic when the English one was never entered.
  const geoName = (ar: string, en: string | null | undefined) => (locale === 'en' && en?.trim() ? en : ar);
  const noCities = cityRows.filter((c) => c.name.includes('العبور'));
  const cities = (noCities.length ? noCities : cityRows).map((c) => ({ id: c.id, name: geoName(c.name, c.nameEn) }));
  const districts = districtRows.map((d) => ({ id: d.id, name: geoName(d.nameAr, d.nameEn) }));
  const neighborhoods = hoodRows.map((n) => ({ id: n.id, name: geoName(n.nameAr, n.nameEn), districtId: n.districtId }));

  const policyHref = content.policyPageSlug ? `/p/${content.policyPageSlug}` : undefined;

  return (
    <StoreShell>
      {/* Compact hero — subtitle on one row (desktop), no redundant CTA button */}
      <section className="bg-navy-800 py-6 text-center text-white">
        <div className="mx-auto max-w-5xl px-4">
          <h1 className="text-2xl font-black text-gold sm:text-3xl">{content.announceTitle}</h1>
          <p className="mx-auto mt-2 text-base text-white/85 sm:whitespace-nowrap">{content.announceBody}</p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
        {/* Registration form FIRST */}
        <section id="offer-form">
          <h2 className="mb-4 text-xl font-bold text-navy-800 dark:text-soft">{L('سجّل بيانات أرضك', 'Register your land details')}</h2>
          <SellForm cities={cities} districts={districts} neighborhoods={neighborhoods} policyHref={policyHref} />
        </section>

        {/* Services strip */}
        <section>
          <h2 className="mb-4 text-xl font-bold text-navy-800 dark:text-soft">{L('الخدمات التي نقدّمها عند بيع أرضك', 'What we do when you sell your land')}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {content.services.map((s) => (
              <div key={s} className="flex items-center gap-2.5 rounded-xl border border-ink-200 bg-white px-4 py-3 text-navy-700">
                <span className="text-gold" aria-hidden>✦</span> {s}
              </div>
            ))}
          </div>
        </section>

        {/* Policies + info: link to a dedicated page when configured, else inline (collapsed) */}
        {policyHref ? (
          <a href={policyHref} className="flex items-center justify-between rounded-2xl border border-gold/40 bg-gold-50 p-5 text-navy-800 hover:bg-gold-100">
            <span className="text-lg font-bold">{L('سياسة البيع والتسعير والمتطلبات', 'Selling policy, pricing and requirements')}</span>
            <span className="text-gold-700" aria-hidden>‹</span>
          </a>
        ) : (
          <details className="group rounded-2xl border border-ink-200 bg-white p-5">
            <summary className="cursor-pointer list-none text-lg font-bold text-navy-800">{L('المزيد من المعلومات والسياسات والتسعير', 'More information, policies and pricing')}</summary>
            <div className="mt-5 space-y-6">
              <div>
                <h3 className="mb-3 text-lg font-bold text-navy-800">{L('التسعير الجيد = بيع أسرع', 'Pricing it well = selling it faster')}</h3>
                {/* overflow-x-auto so the pricing rows stay reachable on a small phone. */}
                <div className="overflow-x-auto rounded-2xl border border-ink-200">
                  <table className="w-full min-w-[24rem] text-sm">
                    <thead className="bg-navy-50 text-navy-700">
                      <tr><th className="p-3 text-start">{L('سعر العرض', 'Asking price')}</th><th className="p-3 text-start">{L('سرعة البيع المتوقعة', 'Expected time to sell')}</th></tr>
                    </thead>
                    <tbody>
                      {content.pricing.map((p) => (
                        <tr key={p.level} className="border-t border-ink-100">
                          <td className="p-3 text-navy-800">{p.level}</td>
                          <td className="p-3 font-medium text-gold-700">{p.saleTime}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Reqs title={L('المطلوب — أرض في كشف التقنين', 'Required — land on a rationing sheet')} groups={[
                  { heading: L('إثبات الملكية', 'Proof of ownership'), items: content.requiredSheet.proof },
                  { heading: L('معلومات الأرض', 'Land information'), items: content.requiredSheet.land },
                  { heading: L('السعر المطلوب', 'Asking price'), items: content.requiredSheet.price },
                ]} />
                <Reqs title={L('المطلوب — أرض مخصصة (تخصيص)', 'Required — allocated land')} groups={[
                  { heading: L('إثبات الملكية', 'Proof of ownership'), items: content.requiredAllocated.proof },
                  { heading: L('معلومات الأرض', 'Land information'), items: content.requiredAllocated.land },
                  { heading: L('السعر المطلوب', 'Asking price'), items: content.requiredAllocated.price },
                ]} />
              </div>

              <div className="rounded-2xl border border-gold/40 bg-gold-50 p-5">
                <h3 className="mb-3 text-lg font-bold text-navy-800">{L('سياسة عرض الأراضي للبيع', 'Land listing policy')}</h3>
                <ul className="space-y-2 text-sm text-navy-700">
                  {content.policy.map((p) => <li key={p} className="flex gap-2"><span className="text-gold-700">•</span> {p}</li>)}
                </ul>
              </div>
            </div>
          </details>
        )}
      </div>
    </StoreShell>
  );
}
