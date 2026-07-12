'use client';

import { useState } from 'react';

// Expandable family-tree of the geo hierarchy (City → District → Neighborhood) — golden
// rule: big tappable nodes, explicit expand buttons separate from the open-page links so
// touch never misfires. Connector lines are simple borders (no chart lib). RTL-aware via
// logical properties (ms-/border-s). Default: city expanded, districts collapsed.
export type TreeCity = { id: string; nameAr: string; nameEn: string; districts: TreeDistrict[] };
export type TreeDistrict = { id: string; nameAr: string; nameEn: string; neighborhoods: TreeNode[] };
export type TreeNode = { id: string; nameAr: string; nameEn: string };

export function GeoTree({ cities, locale }: { cities: TreeCity[]; locale: 'ar' | 'en' }) {
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const name = (n: TreeNode) => (locale === 'ar' ? n.nameAr : n.nameEn);
  const [openCities, setOpenCities] = useState<Set<string>>(() => new Set(cities.map((c) => c.id)));
  const [openDistricts, setOpenDistricts] = useState<Set<string>>(new Set());
  const toggle = (set: Set<string>, id: string, put: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    put(next);
  };

  if (cities.length === 0) return null;
  return (
    <section aria-label={L('شجرة المناطق', 'Areas tree')} className="space-y-4">
      {cities.map((c) => {
        const cOpen = openCities.has(c.id);
        return (
          <div key={c.id}>
            {/* City node */}
            <div className="mx-auto flex w-fit items-center gap-2 rounded-2xl border-2 border-gold bg-navy-800 px-5 py-3 shadow-md">
              <a href={`/explore/city/${c.id}`} className="text-lg font-extrabold text-white hover:text-gold">
                {name(c)}
              </a>
              <button
                type="button"
                onClick={() => toggle(openCities, c.id, setOpenCities)}
                aria-expanded={cOpen}
                aria-label={L(cOpen ? 'طي الأحياء' : 'عرض الأحياء', cOpen ? 'Collapse districts' : 'Show districts')}
                className="grid h-9 w-9 place-items-center rounded-full bg-gold text-lg font-black text-navy-900"
              >
                {cOpen ? '−' : '+'}
              </button>
            </div>

            {cOpen && c.districts.length > 0 && (
              <>
                {/* trunk from the city down */}
                <div className="mx-auto h-5 w-0.5 bg-gold/60" />
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {c.districts.map((d) => {
                    const dOpen = openDistricts.has(d.id);
                    return (
                      <div key={d.id} className="rounded-xl border border-graphite/20 bg-white p-3 dark:bg-navy-900">
                        <div className="flex items-center justify-between gap-2">
                          <a href={`/explore/district/${d.id}`} className="min-w-0 flex-1 truncate text-base font-bold text-primary hover:text-accent">
                            {name(d)}
                          </a>
                          {d.neighborhoods.length > 0 && (
                            <button
                              type="button"
                              onClick={() => toggle(openDistricts, d.id, setOpenDistricts)}
                              aria-expanded={dOpen}
                              aria-label={L(dOpen ? 'طي المجاورات' : 'عرض المجاورات', dOpen ? 'Collapse neighborhoods' : 'Show neighborhoods')}
                              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-gold bg-gold/15 text-base font-black text-primary"
                            >
                              {dOpen ? '−' : `${d.neighborhoods.length}+`}
                            </button>
                          )}
                        </div>
                        {dOpen && (
                          <ul className="ms-3 mt-2 space-y-1.5 border-s-2 border-gold/50 ps-3">
                            {d.neighborhoods.map((n) => (
                              <li key={n.id}>
                                <a
                                  href={`/explore/${n.id}`}
                                  className="block rounded-lg bg-graphite/5 px-3 py-2 text-sm font-semibold text-primary hover:bg-gold/15"
                                >
                                  {name(n)}
                                </a>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        );
      })}
    </section>
  );
}
