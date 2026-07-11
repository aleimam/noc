'use client';

import { toast, track } from '@noc/ui';
import { waLink } from '../../../lib/store';

// Proper brand / action marks instead of emoji.
const IShare = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
);
const IWhatsApp = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="#25D366" aria-hidden>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488" />
  </svg>
);
const IFacebook = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="#1877F2" aria-hidden>
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);
const ILink = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

/** Quick share row: native share sheet (details + photo preview), WhatsApp, Facebook,
 *  and copy-link. The native button falls back to copy where Web Share is unavailable. */
export function ShareButtons({ url, title, whatsapp, locale = 'ar' }: { url: string; title: string; whatsapp?: string; locale?: 'ar' | 'en' }) {
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
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
      () => toast(L('تم نسخ رابط الإعلان', 'Listing link copied')),
      () => toast(L('تعذّر النسخ', 'Could not copy')),
    );
  }
  const open = (href: string, how: string) => {
    track('share', { how });
    window.open(href, '_blank', 'noopener');
  };

  const btn = 'flex flex-1 flex-col items-center gap-1 rounded-xl border border-ink-100 bg-white/60 px-2 py-2 text-[11px] font-semibold text-navy-700 hover:bg-navy-50';
  return (
    <div className="mt-3 flex gap-2">
      <button type="button" onClick={nativeShare} className={btn}><IShare />{L('مشاركة', 'Share')}</button>
      <button type="button" onClick={() => open(waLink(shareText, whatsapp || undefined), 'whatsapp')} className={btn}><IWhatsApp />{L('واتساب', 'WhatsApp')}</button>
      <button type="button" onClick={() => open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, 'facebook')} className={btn}><IFacebook />{L('فيسبوك', 'Facebook')}</button>
      <button type="button" onClick={copy} className={btn}><ILink />{L('نسخ الرابط', 'Copy link')}</button>
    </div>
  );
}
