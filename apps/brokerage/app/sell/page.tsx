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
  const [content, cityRows, districtRows, hoodRows] = await Promise.all([
    getSellContent(),
    prisma.rationingCity.findMany({ where: { isActive: true }, orderBy: [{ order: 'asc' }, { name: 'asc' }], select: { id: true, name: true } }),
    prisma.district.findMany({ where: { isActive: true }, orderBy: { order: 'asc' }, select: { id: true, nameAr: true } }),
    prisma.neighborhood.findMany({ where: { isActive: true }, orderBy: { order: 'asc' }, select: { id: true, nameAr: true, districtId: true } }),
  ]);

  // Offers are limited to New Obour City for now — restrict the city list to it (fallback: all).
  const noCities = cityRows.filter((c) => c.name.includes('العبور'));
  const cities = (noCities.length ? noCities : cityRows).map((c) => ({ id: c.id, name: c.name }));
  const districts = districtRows.map((d) => ({ id: d.id, name: d.nameAr }));
  const neighborhoods = hoodRows.map((n) => ({ id: n.id, name: n.nameAr, districtId: n.districtId }));

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
          <h2 className="mb-4 text-xl font-bold text-navy-800 dark:text-soft">سجّل بيانات أرضك</h2>
          <SellForm cities={cities} districts={districts} neighborhoods={neighborhoods} policyHref={policyHref} />
        </section>

        {/* Services strip */}
        <section>
          <h2 className="mb-4 text-xl font-bold text-navy-800 dark:text-soft">الخدمات التي نقدّمها عند بيع أرضك</h2>
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
            <span className="text-lg font-bold">سياسة البيع والتسعير والمتطلبات</span>
            <span className="text-gold-700" aria-hidden>‹</span>
          </a>
        ) : (
          <details className="group rounded-2xl border border-ink-200 bg-white p-5">
            <summary className="cursor-pointer list-none text-lg font-bold text-navy-800">المزيد من المعلومات والسياسات والتسعير</summary>
            <div className="mt-5 space-y-6">
              <div>
                <h3 className="mb-3 text-lg font-bold text-navy-800">التسعير الجيد = بيع أسرع</h3>
                <div className="overflow-hidden rounded-2xl border border-ink-200">
                  <table className="w-full text-sm">
                    <thead className="bg-navy-50 text-navy-700">
                      <tr><th className="p-3 text-start">سعر العرض</th><th className="p-3 text-start">سرعة البيع المتوقعة</th></tr>
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
                <Reqs title="المطلوب — أرض في كشف التقنين" groups={[
                  { heading: 'إثبات الملكية', items: content.requiredSheet.proof },
                  { heading: 'معلومات الأرض', items: content.requiredSheet.land },
                  { heading: 'السعر المطلوب', items: content.requiredSheet.price },
                ]} />
                <Reqs title="المطلوب — أرض مخصصة (تخصيص)" groups={[
                  { heading: 'إثبات الملكية', items: content.requiredAllocated.proof },
                  { heading: 'معلومات الأرض', items: content.requiredAllocated.land },
                  { heading: 'السعر المطلوب', items: content.requiredAllocated.price },
                ]} />
              </div>

              <div className="rounded-2xl border border-gold/40 bg-gold-50 p-5">
                <h3 className="mb-3 text-lg font-bold text-navy-800">سياسة عرض الأراضي للبيع</h3>
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
