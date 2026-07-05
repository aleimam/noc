'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { toast } from '@noc/ui';
import { setOptionAttributes } from '../../actions';

type Section = { id: string; name: string; attributes: { id: string; label: string }[] };
type Filter = 'all' | 'applicable' | 'notApplicable';

// Per-category (classifier option) attribute grid: tick which details apply to THIS
// option. Toggles auto-save (so clicking an attribute name to open its edit page never
// loses work). The name links to the attribute's edit page; the checkbox is the "applies
// here" flag. A filter narrows to all / applicable / non-applicable.
export function OptionAttributesGrid({
  optionId,
  sections,
  initialAttrIds,
}: {
  optionId: string;
  sections: Section[];
  initialAttrIds: string[];
}) {
  const t = useTranslations('mp');
  const [, start] = useTransition();
  const [checked, setChecked] = useState<Set<string>>(new Set(initialAttrIds));
  const [filter, setFilter] = useState<Filter>('all');

  function persist(next: Set<string>) {
    start(async () => {
      const r = await setOptionAttributes(optionId, [...next]);
      if (!r.ok) toast(t('none'), 'error');
    });
  }
  function toggle(id: string) {
    setChecked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      persist(n);
      return n;
    });
  }

  const shown = useMemo(() => {
    const visible = (id: string) =>
      filter === 'all' ? true : filter === 'applicable' ? checked.has(id) : !checked.has(id);
    return sections
      .map((s) => ({ ...s, attrs: s.attributes.filter((a) => visible(a.id)) }))
      .filter((s) => s.attrs.length > 0);
  }, [sections, filter, checked]);

  const fbtn = (f: Filter, label: string) => (
    <button
      type="button"
      onClick={() => setFilter(f)}
      className={`rounded-full px-3 py-1 text-xs ${filter === f ? 'bg-primary text-soft' : 'border border-graphite/25'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-3 rounded-lg border border-graphite/15 p-3 sm:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-primary">
          {t('applicableDetails')} <span className="opacity-60">({checked.size})</span>
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {fbtn('all', t('filterAll'))}
          {fbtn('applicable', t('filterApplicable'))}
          {fbtn('notApplicable', t('filterNotApplicable'))}
        </div>
      </div>
      <p className="text-xs opacity-60">{t('applicableDetailsHint')}</p>

      <div className="space-y-3">
        {shown.map((s) => (
          <div key={s.id}>
            <div className="mb-1 text-xs font-bold uppercase tracking-wide opacity-60">{s.name}</div>
            <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
              {s.attrs.map((a) => (
                <div key={a.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={checked.has(a.id)} onChange={() => toggle(a.id)} />
                  <Link href={`/admin/marketplace/attributes/${a.id}`} className="text-accent hover:underline">
                    {a.label}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        ))}
        {shown.length === 0 && <p className="text-xs opacity-50">{t('none')}</p>}
      </div>
    </div>
  );
}
