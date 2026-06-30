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

  const cities = cityRows.map((c) => ({ id: c.id, name: c.name }));
  const districts = districtRows.map((d) => ({ id: d.id, name: d.nameAr }));
  const neighborhoods = hoodRows.map((n) => ({ id: n.id, name: n.nameAr, districtId: n.districtId }));

  return (
    <StoreShell>
      <section className="bg-navy-800 py-12 text-center text-white">
        <div className="mx-auto max-w-3xl px-4">
          <h1 className="text-3xl font-black text-gold sm:text-4xl">{content.announceTitle}</h1>
          <p className="mx-auto mt-3 max-w-2xl text-lg text-white/85">{content.announceBody}</p>
          <a href="#offer-form" className="mt-6 inline-block rounded-xl bg-gold px-7 py-3 font-bold text-navy-900">ابدأ الآن</a>
        </div>
      </section>

      <div className="mx-auto max-w-5xl space-y-8 px-4 py-10">
        <section>
          <h2 className="mb-4 text-xl font-bold text-navy-800">الخدمات التي نقدّمها عند بيع أرضك</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {content.services.map((s) => (
              <div key={s} className="flex items-center gap-2.5 rounded-xl border border-ink-200 bg-white px-4 py-3 text-navy-700">
                <span className="text-gold" aria-hidden>✦</span> {s}
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-xl font-bold text-navy-800">التسعير الجيد = بيع أسرع</h2>
          <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white">
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
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
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
        </section>

        <section id="offer-form">
          <h2 className="mb-4 text-xl font-bold text-navy-800">سجّل بيانات أرضك</h2>
          <SellForm cities={cities} districts={districts} neighborhoods={neighborhoods} />
        </section>

        <section className="rounded-2xl border border-gold/40 bg-gold-50 p-5">
          <h2 className="mb-3 text-lg font-bold text-navy-800">سياسة عرض الأراضي للبيع</h2>
          <ul className="space-y-2 text-sm text-navy-700">
            {content.policy.map((p) => <li key={p} className="flex gap-2"><span className="text-gold-700">•</span> {p}</li>)}
          </ul>
        </section>
      </div>
    </StoreShell>
  );
}
