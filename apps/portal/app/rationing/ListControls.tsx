'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

export function ListControls({ sortOptions, defaultSort }: { sortOptions: { value: string; label: string }[]; defaultSort: string }) {
  const t = useTranslations('rationing');
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const per = sp.get('per') ?? '10';
  const sort = sp.get('sort') ?? defaultSort;

  function set(key: string, value: string) {
    const p = new URLSearchParams(sp.toString());
    p.set(key, value);
    p.delete('page');
    router.push(`${path}?${p.toString()}`);
  }

  const sel = 'rounded-lg border border-ink-200 bg-white px-2 py-1 text-sm';
  return (
    <div className="flex flex-wrap items-center gap-4 text-sm text-ink-600">
      <label className="flex items-center gap-2">
        {t('perPage')}
        <select value={per} onChange={(e) => set('per', e.target.value)} className={sel}>
          <option value="10">10</option>
          <option value="25">25</option>
          <option value="50">50</option>
        </select>
      </label>
      <label className="flex items-center gap-2">
        {t('sortBy')}
        <select value={sort} onChange={(e) => set('sort', e.target.value)} className={sel}>
          {sortOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
    </div>
  );
}
