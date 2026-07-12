'use client';

import { useState, useTransition } from 'react';
import { toast } from '@noc/ui';
import { saveGeoInheritance } from './actions';

type Category = 'updates' | 'amenities' | 'advantages' | 'maps';
type Transition = 'cityToDistrict' | 'districtToNeighborhood' | 'toListing';
type Matrix = Record<Category, Record<Transition, boolean>>;

/**
 * The admin on/off matrix for geo content inheritance: rows = content categories,
 * columns = the three downward transitions. Saved as one Setting ('geo.inheritance').
 * Note: city-level amenities have no schema support yet — that cell is stored but inert.
 */
export function InheritanceMatrix({ initial, locale }: { initial: Matrix; locale: 'ar' | 'en' }) {
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const [m, setM] = useState<Matrix>(initial);
  const [pending, start] = useTransition();

  const categories: { key: Category; label: string }[] = [
    { key: 'updates', label: L('التحديثات', 'Updates') },
    { key: 'amenities', label: L('المرافق', 'Amenities') },
    { key: 'advantages', label: L('المميزات', 'Advantages') },
    { key: 'maps', label: L('الخرائط', 'Maps') },
  ];
  const transitions: { key: Transition; label: string }[] = [
    { key: 'cityToDistrict', label: L('المدينة ← الحي', 'City → District') },
    { key: 'districtToNeighborhood', label: L('الحي ← المجاورة', 'District → Neighborhood') },
    { key: 'toListing', label: L('إلى الإعلان', 'To listing') },
  ];

  function toggle(c: Category, tr: Transition) {
    setM((prev) => ({ ...prev, [c]: { ...prev[c], [tr]: !prev[c][tr] } }));
  }
  function save() {
    start(async () => {
      const r = await saveGeoInheritance(m);
      if (r.ok) toast(L('تم الحفظ ✓', 'Saved ✓'));
      else toast(L('تعذّر الحفظ', 'Save failed'), 'error');
    });
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] text-sm">
          <thead>
            <tr>
              <th className="p-2 text-start font-semibold opacity-70">{L('المحتوى', 'Content')}</th>
              {transitions.map((tr) => (
                <th key={tr.key} className="p-2 text-center font-semibold opacity-70">{tr.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.key} className="border-t border-graphite/10">
                <td className="p-2 font-semibold text-primary">{c.label}</td>
                {transitions.map((tr) => (
                  <td key={tr.key} className="p-2 text-center">
                    <label className="inline-flex cursor-pointer items-center justify-center p-2">
                      <input
                        type="checkbox"
                        checked={m[c.key][tr.key]}
                        onChange={() => toggle(c.key, tr.key)}
                        className="h-6 w-6 accent-primary"
                        aria-label={`${c.label} — ${tr.label}`}
                      />
                    </label>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs opacity-60">
        {L(
          'ملحوظة: مرافق المدينة غير مدعومة بعد — خانة «المرافق: المدينة ← الحي» بلا تأثير حالياً.',
          'Note: city-level amenities are not supported yet — the “Amenities: City → District” cell has no effect for now.',
        )}
      </p>
      <button disabled={pending} onClick={save} className="rounded bg-primary px-4 py-2 text-sm font-semibold text-soft disabled:opacity-50">
        {L('حفظ', 'Save')}
      </button>
    </div>
  );
}
