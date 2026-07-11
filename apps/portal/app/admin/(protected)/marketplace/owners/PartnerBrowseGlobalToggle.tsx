'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@noc/ui';
import { setPartnerBrowseGlobal } from '../actions';

/** Global master switch: let partners browse (view-only) all published offers from their
 *  portal. Each partner also has their own flag (in the partner-portal panel). */
export function PartnerBrowseGlobalToggle({ initial, locale }: { initial: boolean; locale: 'ar' | 'en' }) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  function toggle(next: boolean) {
    setOn(next);
    start(async () => {
      const r = await setPartnerBrowseGlobal(next);
      if (r.ok) { toast(L('تم الحفظ', 'Saved')); router.refresh(); }
      else { setOn(!next); toast(L('تعذّر الحفظ', 'Save failed'), 'error'); }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gold-300/50 bg-gold/10 p-3 text-sm">
      <label className="flex items-center gap-2 font-semibold text-primary">
        <input type="checkbox" checked={on} disabled={pending} onChange={(e) => toggle(e.target.checked)} />
        {L('السماح للشركاء بتصفح جميع عروضنا (عام)', 'Let partners browse all our listings (global)')}
      </label>
      <span className="opacity-70">{L('عند التفعيل يظهر «تصفّح العروض» في بوابة كل شريك مسموح له — عروض متجر الصواري فقط (للاطلاع فقط).', 'When on, each allowed partner sees a view-only “Browse offers” tab — Al Sawarey storefront listings only.')}</span>
    </div>
  );
}
