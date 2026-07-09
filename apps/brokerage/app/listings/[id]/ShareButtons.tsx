'use client';

import { toast, track } from '@noc/ui';
import { waLink } from '../../../lib/store';

/** Quick share row: native share sheet (details + photo preview), WhatsApp, Facebook,
 *  and copy-link. The native button falls back to copy where Web Share is unavailable. */
export function ShareButtons({ url, title, whatsapp }: { url: string; title: string; whatsapp?: string }) {
  const shareText = `${title}\n${url}`;

  async function nativeShare() {
    track('share', { how: 'native' });
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text: title, url });
        return;
      } catch {
        return; // user dismissed the sheet
      }
    }
    copy();
  }
  function copy() {
    track('share', { how: 'copy' });
    navigator.clipboard?.writeText(url).then(
      () => toast('تم نسخ رابط الإعلان'),
      () => toast('تعذّر النسخ'),
    );
  }
  const open = (href: string, how: string) => {
    track('share', { how });
    window.open(href, '_blank', 'noopener');
  };

  const btn = 'flex flex-1 flex-col items-center gap-1 rounded-xl border border-ink-100 bg-white/60 px-2 py-2 text-[11px] font-semibold text-navy-700 hover:bg-navy-50';
  return (
    <div className="mt-3 flex gap-2">
      <button type="button" onClick={nativeShare} className={btn}><span className="text-lg" aria-hidden>📤</span>مشاركة</button>
      <button type="button" onClick={() => open(waLink(shareText, whatsapp || undefined), 'whatsapp')} className={btn}><span className="text-lg" aria-hidden>💬</span>واتساب</button>
      <button type="button" onClick={() => open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, 'facebook')} className={btn}><span className="text-lg" aria-hidden>📘</span>فيسبوك</button>
      <button type="button" onClick={copy} className={btn}><span className="text-lg" aria-hidden>🔗</span>نسخ الرابط</button>
    </div>
  );
}
