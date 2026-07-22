'use client';

import { useTransition } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from '@noc/ui';
import { approveListing } from '../../marketplace/actions';

/** One-click approve (publish) for a PENDING row, straight from the market list — no need to open
 *  the moderation queue. Uses the SAME server action as the queue, so the required-details gate
 *  still applies: if a required detail is missing, approveListing refuses and names it, and that
 *  name is surfaced in the toast instead of a bare failure. */
export function ApproveListingButton({ id }: { id: string }) {
  const locale = useLocale() as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const t = useTranslations('mp');
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <button
      disabled={pending}
      title={t('approve')}
      aria-label={t('approve')}
      onClick={() =>
        start(async () => {
          const r = await approveListing(id);
          if (!r.ok) {
            toast(
              r.error === 'missing_required' && r.missing?.length
                ? L(`لا يمكن النشر — بيانات مطلوبة ناقصة: ${r.missing.join('، ')}`, `Cannot publish — required details are missing: ${r.missing.join(', ')}`)
                : L('تعذّر النشر', 'Approve failed'),
              'error',
            );
            return;
          }
          toast(L('تم النشر', 'Published'));
          router.refresh();
        })
      }
      className="inline-flex items-center gap-1 rounded-md bg-green px-2.5 py-1 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
    >
      ✓ {t('approve')}
    </button>
  );
}
