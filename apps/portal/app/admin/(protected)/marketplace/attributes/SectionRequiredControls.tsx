'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from '@noc/ui';
import { setSectionRequired } from '../actions';

/** Group-level bulk toggle: make every detail in this section required / optional in one click.
 *  (Per-attribute overrides still happen inside each attribute's edit page.) */
export function SectionRequiredControls({ sectionId }: { sectionId: string }) {
  const t = useTranslations('mp');
  const router = useRouter();
  const [pending, start] = useTransition();

  const run = (required: boolean) => {
    if (!confirm(required ? t('confirmAllRequired') : t('confirmAllOptional'))) return;
    start(async () => {
      try {
        const r = await setSectionRequired(sectionId, required);
        if (!r.ok) { toast(t('saveFailed'), 'error'); return; }
        router.refresh();
      } catch {
        toast(t('saveFailed'), 'error'); // e.g. VIEW-only staff — requirePermission throws
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="opacity-60">{t('groupRequired')}:</span>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(true)}
        className="min-h-[36px] rounded-md border border-red-300 px-3 py-1 font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        ★ {t('makeAllRequired')}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(false)}
        className="min-h-[36px] rounded-md border border-graphite/25 px-3 py-1 hover:bg-graphite/10 disabled:opacity-50"
      >
        {t('makeAllOptional')}
      </button>
    </div>
  );
}
