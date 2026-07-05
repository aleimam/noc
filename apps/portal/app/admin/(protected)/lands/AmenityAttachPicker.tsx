'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { toast } from '@noc/ui';
import { setAmenityPlacements } from './actions';

type Opt = { id: string; label: string; category: string };

// Attach library amenities to a place (neighborhood / district / listing). Toggles auto-save.
export function AmenityAttachPicker({
  scope,
  scopeId,
  options,
  initial,
}: {
  scope: 'neighborhood' | 'district' | 'listing';
  scopeId: string;
  options: Opt[];
  initial: string[];
}) {
  const t = useTranslations('lands');
  const [, start] = useTransition();
  const [checked, setChecked] = useState<Set<string>>(new Set(initial));
  const [q, setQ] = useState('');

  function persist(next: Set<string>) {
    start(async () => {
      const r = await setAmenityPlacements(scope, scopeId, [...next]);
      if (!r.ok) toast('⚠', 'error');
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
    const needle = q.trim().toLowerCase();
    return needle ? options.filter((o) => `${o.label} ${o.category}`.toLowerCase().includes(needle)) : options;
  }, [options, q]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm opacity-70">
          {t('amenityAttachHint')} <span className="font-semibold">({checked.size})</span>
        </span>
        <Link href="/admin/lands/amenities" className="whitespace-nowrap text-xs text-accent hover:underline">
          {t('amenityLibrary')} ↗
        </Link>
      </div>
      {options.length === 0 ? (
        <p className="text-sm opacity-60">
          {t('amenityLibraryEmpty')}{' '}
          <Link href="/admin/lands/amenities" className="text-accent">{t('amenityLibrary')}</Link>
        </p>
      ) : (
        <>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔎" className="w-full rounded-md border border-graphite/20 bg-transparent px-3 py-1.5 text-sm" />
          <div className="grid max-h-72 gap-1 overflow-auto rounded-md border border-graphite/15 p-2 sm:grid-cols-2">
            {shown.map((o) => (
              <label key={o.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={checked.has(o.id)} onChange={() => toggle(o.id)} />
                <span>
                  {o.label}
                  {o.category ? <span className="opacity-50"> · {o.category}</span> : null}
                </span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
