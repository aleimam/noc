'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from '@noc/ui';
import { POSTER_ICON_KEYS, POSTER_ICONS, POSTER_ICON_LABELS, type PosterIconKey } from '../../../../../lib/poster/icons';
import { setSectionIcon } from '../actions';

type Row = { id: string; nameAr: string; nameEn: string; icon: string | null };

function IconPreview({ k, active }: { k: PosterIconKey; active: boolean }) {
  return (
    <svg viewBox="-22 -22 44 44" className={`h-7 w-7 rounded-full p-0.5 ${active ? 'bg-navy-800' : 'bg-navy-800/70'}`} aria-hidden>
      {/* Shapes come from our own static icon library (constants, not user input). */}
      <g dangerouslySetInnerHTML={{ __html: POSTER_ICONS[k] }} />
    </svg>
  );
}

/** Per-section picker for the icon used on that group's generated listing card. */
export function SectionIconPicker({ sections }: { sections: Row[] }) {
  const t = useTranslations('mp');
  const locale = useLocale() as 'ar' | 'en';
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function pick(id: string, icon: string | null) {
    setBusyId(id);
    start(async () => {
      const r = await setSectionIcon(id, icon);
      setBusyId(null);
      if (r.ok) {
        toast(t('savedOk'));
        router.refresh();
      }
    });
  }

  return (
    <section className="space-y-2 rounded-lg border border-graphite/15 p-4">
      <h2 className="font-bold text-primary">{t('posterIcons')}</h2>
      <p className="text-xs opacity-70">{t('posterIconsHint')}</p>
      <div className="divide-y divide-graphite/10">
        {sections.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center gap-2 py-2">
            <span className={`w-40 text-sm font-semibold ${busyId === s.id ? 'opacity-50' : ''}`}>
              {locale === 'ar' ? s.nameAr : s.nameEn}
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={() => pick(s.id, null)}
              className={`rounded-full border px-3 py-1 text-xs ${s.icon === null ? 'border-accent bg-accent/10 font-bold text-accent' : 'border-graphite/25 opacity-70 hover:opacity-100'}`}
            >
              {t('posterIconAuto')}
            </button>
            {POSTER_ICON_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                disabled={pending}
                onClick={() => pick(s.id, k)}
                title={POSTER_ICON_LABELS[k][locale]}
                className={`rounded-full border p-0.5 ${s.icon === k ? 'border-accent ring-2 ring-accent/40' : 'border-transparent opacity-70 hover:opacity-100'}`}
              >
                <IconPreview k={k} active={s.icon === k} />
              </button>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
