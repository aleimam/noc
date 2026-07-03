'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from '@noc/ui';
import { setOptionAttributes } from '../actions';

type Opt = { id: string; name: string };
type ClassifierGroup = { key: string; name: string; options: Opt[] };
type Section = { id: string; name: string; attributes: { id: string; label: string }[] };

export function CategoryAttributesManager({
  classifiers,
  sections,
  linksByOption,
}: {
  classifiers: ClassifierGroup[];
  sections: Section[];
  linksByOption: Record<string, string[]>;
}) {
  const t = useTranslations('mp');
  const router = useRouter();
  const [pending, start] = useTransition();
  const firstOption = classifiers.find((c) => c.options.length)?.options[0]?.id ?? '';
  const [optionId, setOptionId] = useState(firstOption);
  const [checked, setChecked] = useState<Set<string>>(new Set(linksByOption[firstOption] ?? []));

  // Reset the checklist whenever the selected category (or server data) changes.
  useEffect(() => {
    setChecked(new Set(linksByOption[optionId] ?? []));
  }, [optionId, linksByOption]);

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
      if (r.ok) { toast(t('savedOk')); router.refresh(); }
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

      <div className="space-y-4">
        {sections.map((sec) => {
          const all = sec.attributes.length > 0 && sec.attributes.every((a) => checked.has(a.id));
          return (
            <div key={sec.id} className="rounded-lg border border-graphite/15 p-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold text-primary">{sec.name}</h3>
                <button type="button" onClick={() => setSection(sec, !all)} className="rounded border border-graphite/25 px-2 py-0.5 text-xs">
                  {all ? t('clear') : t('selectAll')}
                </button>
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
