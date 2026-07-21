'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from '@noc/ui';
import { approveListing } from '../../marketplace/actions';

/** One-click approve (publish) for a PENDING row, straight from the market list — no need to open
 *  the moderation queue. Uses the SAME server action as the queue, so the required-details gate
 *  still applies: if a required detail is missing, approveListing refuses and names it, and that
 *  name is surfaced in the toast instead of a bare failure. */
export function ApproveListingButton({ id }: { id: string }) {
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
                ? `لا يمكن النشر — بيانات مطلوبة ناقصة: ${r.missing.join('، ')}`
                : 'تعذّر النشر / Approve failed',
              'error',
            );
            return;
          }
          toast('تم النشر / Published');
          router.refresh();
        })
      }
      className="inline-flex items-center gap-1 rounded-md bg-green px-2.5 py-1 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
    >
      ✓ {t('approve')}
    </button>
  );
}
