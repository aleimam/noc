'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

/** Finish button for the auto-saving geo edit pages: everything already saved as you went, so
 *  this just returns to the list. Labelled «تم» (Done), NOT «حفظ», to match the auto-save model. */
export function DoneButton({ href }: { href: string }) {
  const t = useTranslations('lands');
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.push(href)}
      className="rounded-md bg-primary px-6 py-2 text-sm font-bold text-soft"
    >
      {t('done')} ✓
    </button>
  );
}
