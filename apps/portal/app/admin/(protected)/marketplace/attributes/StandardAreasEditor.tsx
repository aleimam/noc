'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from '@noc/ui';
import { saveStandardAreas } from '../actions';

export function StandardAreasEditor({ areas }: { areas: number[] }) {
  const t = useTranslations('mp');
  const router = useRouter();
  const [text, setText] = useState(areas.join('، '));
  const [pending, start] = useTransition();

  function save() {
    const list = text
      .split(/[،,\s]+/)
      .map((s) => parseInt(s.replace(/[^\d]/g, ''), 10))
      .filter((n) => Number.isFinite(n) && n > 0);
    start(async () => {
      const r = await saveStandardAreas(list);
      if (r.ok) { router.refresh(); toast(t('savedOk')); }
    });
  }

  return (
    <div className="space-y-2 rounded-lg border border-graphite/15 p-4">
      <h2 className="font-semibold text-primary">{t('standardAreas')}</h2>
      <p className="text-xs opacity-60">{t('standardAreasHint')}</p>
      <div className="flex flex-wrap items-center gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} dir="ltr" className="min-w-[16rem] flex-1 rounded-md border border-graphite/20 bg-transparent px-3 py-2 text-sm" />
        <button disabled={pending} onClick={save} className="rounded-md bg-primary px-4 py-2 text-sm text-soft disabled:opacity-50">{t('saveStandardAreas')}</button>
      </div>
    </div>
  );
}
