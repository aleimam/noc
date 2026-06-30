'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

// A prominent Save button for the multi-editor edit pages. Each section already saves
// its items as they're added/edited; this confirms + refreshes and shows a clear
// "saved" toast so staff always get feedback. Drop it at the top and bottom of a page.
export function EditSaveBar({ hint = false }: { hint?: boolean }) {
  const t = useTranslations('lands');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  function save() {
    start(async () => {
      router.refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  return (
    <div className="flex items-center gap-3">
      <button onClick={save} disabled={pending} className="rounded-md bg-primary px-6 py-2 text-sm font-bold text-soft disabled:opacity-50">
        {pending ? '…' : t('saveAll')}
      </button>
      {hint && <span className="text-xs opacity-60">{t('autosaveHint')}</span>}
      {saved && (
        <div className="fixed inset-x-0 top-3 z-[60] mx-auto w-fit rounded-full bg-green px-5 py-2 text-sm font-bold text-white shadow-lg">
          {t('savedAll')} ✓
        </div>
      )}
    </div>
  );
}
