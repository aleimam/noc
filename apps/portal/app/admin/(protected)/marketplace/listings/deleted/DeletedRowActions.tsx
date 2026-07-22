'use client';

import { useTransition } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from '@noc/ui';
import { restoreListing, purgeListing } from '../../actions';

/** Trash row controls: restore the listing exactly as it was, or purge it for good NOW
 *  (double confirmation — this one really is irreversible). */
export function DeletedRowActions({ id, title }: { id: string; title: string }) {
  const locale = useLocale() as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const t = useTranslations('mp');
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <span className="inline-flex items-center gap-3">
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await restoreListing(id);
            if (!r.ok) { toast(L('تعذّر الاسترجاع', 'Restore failed'), 'error'); return; }
            toast(L('تم الاسترجاع', 'Restored'));
            router.refresh();
          })
        }
        className="font-semibold text-green hover:underline disabled:opacity-50"
      >
        ↩︎ {L('استرجاع', 'Restore')}
      </button>
      <button
        disabled={pending}
        onClick={() => {
          if (!confirm(`${t('confirmDeleteListing')}\n\n«${title}»`)) return;
          if (!confirm(L('⚠️ هذا حذف نهائي فوري — الصور والبيانات ستُمحى ولا يمكن استرجاعها. متأكد؟', '⚠️ This deletes permanently and immediately — photos and data will be erased and cannot be recovered. Are you sure?'))) return;
          start(async () => {
            const r = await purgeListing(id);
            if (!r.ok) { toast(L('تعذّر الحذف', 'Delete failed'), 'error'); return; }
            toast(L('حُذف نهائياً', 'Purged'));
            router.refresh();
          });
        }}
        className="text-red-600 hover:underline disabled:opacity-50"
      >
        {L('حذف نهائي', 'Delete permanently')}
      </button>
    </span>
  );
}
