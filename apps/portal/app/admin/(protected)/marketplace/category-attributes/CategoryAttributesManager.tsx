'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from '@noc/ui';
import { setOptionAttributes, setCategorySectionRender } from '../actions';

type Opt = { id: string; name: string };
type ClassifierGroup = { key: string; name: string; options: Opt[] };
type Section = { id: string; name: string; attributes: { id: string; label: string }[] };
type Mark = { makeCard: boolean; onPoster: boolean };

export function CategoryAttributesManager({
  classifiers,
  sections,
  linksByOption,
  marksByOption = {},
}: {
  classifiers: ClassifierGroup[];
  sections: Section[];
  linksByOption: Record<string, string[]>;
  marksByOption?: Record<string, Record<string, Mark>>;
}) {
  const t = useTranslations('mp');
  const router = useRouter();
  const [pending, start] = useTransition();
  const firstOption = classifiers.find((c) => c.options.length)?.options[0]?.id ?? '';
  const [optionId, setOptionId] = useState(firstOption);
  const [checked, setChecked] = useState<Set<string>>(new Set(linksByOption[firstOption] ?? []));
  // Generated-image marks per group — meaningful for Type options only.
  const [marks, setMarks] = useState<Record<string, Mark>>(marksByOption[firstOption] ?? {});
  const isTypeOption = classifiers.find((c) => c.key === 'type')?.options.some((o) => o.id === optionId) ?? false;
  const markOf = (secId: string): Mark => marks[secId] ?? { makeCard: true, onPoster: false };
  const setMark = (secId: string, patch: Partial<Mark>) =>
    setMarks((m) => ({ ...m, [secId]: { ...(m[secId] ?? { makeCard: true, onPoster: false }), ...patch } }));

  // Reset the checklist whenever the selected category (or server data) changes.
  useEffect(() => {
    setChecked(new Set(linksByOption[optionId] ?? []));
    setMarks(marksByOption[optionId] ?? {});
  }, [optionId, linksByOption, marksByOption]);

  const toggle = (id: string) =>
    setChecked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const setSection = (sec: Section, on: boolean) =>
    setChecked((s) => {
      const n = new Set(s);
      for (const a of sec.attributes) { if (on) n.add(a.id); else n.delete(a.id); }
      return n;
    });

  function save() {
    if (!optionId) return;
    start(async () => {
      const r = await setOptionAttributes(optionId, [...checked]);
      let ok = r.ok;
      if (ok && isTypeOption) {
        // Skip the Area group (first) — it is always on the poster, never a card.
        const r2 = await setCategorySectionRender(
          optionId,
          sections.slice(1).map((s) => ({ sectionId: s.id, ...markOf(s.id) })),
        );
        ok = r2.ok;
      }
      if (ok) { toast(t('savedOk')); router.refresh(); }
      else toast(t('none'), 'error');
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          {t('pickCategory')}
          <select value={optionId} onChange={(e) => setOptionId(e.target.value)} className="mt-1 block min-w-[16rem] rounded-md border border-graphite/20 bg-transparent px-3 py-2 text-sm">
            {classifiers.map((c) => (
              <optgroup key={c.key} label={c.name}>
                {c.options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        <button disabled={pending || !optionId} onClick={save} className="rounded-md bg-primary px-5 py-2 text-sm font-bold text-soft disabled:opacity-50">
          {t('save')} ({checked.size})
        </button>
      </div>

      <p className="text-xs opacity-60">{t('categoryAttrsHint')}</p>
      {isTypeOption && <p className="text-xs opacity-60">🃏 {t('markHint')}</p>}

      <div className="space-y-4">
        {sections.map((sec, secIdx) => {
          const all = sec.attributes.length > 0 && sec.attributes.every((a) => checked.has(a.id));
          const mk = markOf(sec.id);
          const isAreaGroup = secIdx === 0; // first group = Area: always on the poster, never a card
          return (
            <div key={sec.id} className="rounded-lg border border-graphite/15 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-primary">{sec.name}</h3>
                <div className="flex items-center gap-3">
                  {isTypeOption && isAreaGroup && (
                    <span className="rounded-full bg-navy-800 px-3 py-0.5 text-xs font-semibold text-white">📄 {t('areaAlwaysPoster')}</span>
                  )}
                  {isTypeOption && !isAreaGroup && (
                    <>
                      <label className="flex items-center gap-1 rounded-full border border-gold-300/60 bg-gold/10 px-2 py-0.5 text-xs font-semibold">
                        <input type="checkbox" checked={mk.makeCard} onChange={(e) => setMark(sec.id, { makeCard: e.target.checked })} />
                        🃏 {t('markCard')}
                      </label>
                      <label className="flex items-center gap-1 rounded-full border border-gold-300/60 bg-gold/10 px-2 py-0.5 text-xs font-semibold">
                        <input type="checkbox" checked={mk.onPoster} onChange={(e) => setMark(sec.id, { onPoster: e.target.checked })} />
                        📄 {t('markPoster')}
                      </label>
                    </>
                  )}
                  <button type="button" onClick={() => setSection(sec, !all)} className="rounded border border-graphite/25 px-2 py-0.5 text-xs">
                    {all ? t('clear') : t('selectAll')}
                  </button>
                </div>
              </div>
              <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                {sec.attributes.map((a) => (
                  <label key={a.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={checked.has(a.id)} onChange={() => toggle(a.id)} />
                    {a.label}
                  </label>
                ))}
                {sec.attributes.length === 0 && <span className="text-xs opacity-50">{t('none')}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
