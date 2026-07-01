'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

type Field = 'all' | 'name' | 'owner' | 'plot' | 'block';
type City = { id: string; name: string };

export function SearchBar({
  initialQ = '',
  initialField = 'all',
  initialCity = '',
  cities,
  dymGloballyEnabled,
  dymOptOut,
}: {
  initialQ?: string;
  initialField?: Field;
  initialCity?: string;
  cities: City[];
  dymGloballyEnabled: boolean;
  dymOptOut: boolean;
}) {
  const t = useTranslations('rationing');
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const [field, setField] = useState<Field>(initialField);
  const [city, setCity] = useState(initialCity);
  const [advanced, setAdvanced] = useState(initialField !== 'all');
  const [dym, setDym] = useState(!dymOptOut);

  function submit() {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (field !== 'all') params.set('field', field);
    if (city) params.set('city', city);
    if (dymGloballyEnabled && !dym) params.set('dym', '0');
    router.push(`/rationing?${params.toString()}`);
  }

  return (
    <div className="rounded-2xl bg-white p-3.5 shadow-md">
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          value={field}
          onChange={(e) => setField(e.target.value as Field)}
          className="h-12 rounded-xl border border-ink-200 bg-soft px-4 text-base text-navy-800 sm:h-16 sm:w-48 sm:text-lg"
          aria-label={t('searchField')}
        >
          <option value="all">{t('fieldAll')}</option>
          <option value="name">{t('colApplicant')}</option>
          <option value="owner">{t('colOwner')}</option>
          <option value="plot">{t('colPlot')}</option>
          <option value="block">{t('colBlock')}</option>
        </select>

        <div className="flex h-[110px] flex-1 items-center gap-2.5 rounded-2xl border-2 border-gold/70 bg-white px-4 shadow-sm sm:h-16">
          <span className="text-3xl text-gold sm:text-2xl" aria-hidden>⌕</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder={t('searchPlaceholder')}
            className="flex-1 bg-transparent text-3xl text-navy-800 outline-none placeholder:text-ink-400 sm:text-2xl"
            aria-label={t('search')}
          />
        </div>

        <button
          onClick={submit}
          className="h-16 rounded-xl bg-gold px-8 text-2xl font-bold text-navy-900 transition hover:brightness-105 sm:text-xl"
        >
          {t('search')}
        </button>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-sm">
        <button onClick={() => setAdvanced((a) => !a)} className="flex items-center gap-1.5 text-navy-600">
          <span>⚙</span> {t('advancedSearch')}
        </button>
        {cities.length > 0 && (
          <label className="flex items-center gap-2 text-ink-600">
            {t('colCity')}:
            <select value={city} onChange={(e) => setCity(e.target.value)} className="rounded-lg border border-ink-200 bg-white px-2 py-1 text-sm">
              <option value="">{t('allCities')}</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        )}
        {dymGloballyEnabled && (
          <label className="flex items-center gap-2 text-ink-600">
            <input type="checkbox" checked={dym} onChange={(e) => setDym(e.target.checked)} />
            {t('dymToggle')}
          </label>
        )}
      </div>

      {advanced && (
        <p className="mt-2 px-1 text-xs text-ink-500">{t('advancedHint')}</p>
      )}
    </div>
  );
}
