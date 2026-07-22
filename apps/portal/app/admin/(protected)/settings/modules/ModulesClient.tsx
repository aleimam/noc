'use client';

import { useState, useTransition } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { toast } from '@noc/ui';
import { setModules } from './actions';

export function ModulesClient({ initial, labels }: { initial: Record<string, boolean>; labels: Record<string, string> }) {
  const locale = useLocale() as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  function save() {
    setSaved(false);
    start(async () => {
      const r = await setModules(state);
      if (r.ok) {
        setSaved(true);
        router.refresh();
      } else {
        toast(L('تعذّر الحفظ', 'Save failed'), 'error');
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="divide-y divide-graphite/10 rounded-lg border border-graphite/15">
        {Object.entries(labels).map(([key, label]) => (
          <label key={key} className="flex cursor-pointer items-center justify-between gap-3 p-3 text-sm">
            <span>{label}</span>
            <input type="checkbox" checked={state[key] !== false} onChange={(e) => setState((s) => ({ ...s, [key]: e.target.checked }))} className="h-5 w-5" />
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button disabled={pending} onClick={save} className="rounded-md bg-primary px-5 py-2 text-sm text-soft disabled:opacity-50">{pending ? L('جارٍ الحفظ…', 'Saving…') : L('حفظ', 'Save')}</button>
        {saved && <span className="text-sm text-green">{L('تم الحفظ ✓', 'Saved ✓')}</span>}
      </div>
    </div>
  );
}
