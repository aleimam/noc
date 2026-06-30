'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { getConsent, setConsent, CONSENT_EVENT } from '../lib/track';

/** Injects GA4 + Meta Pixel only after the visitor consents. IDs come from the backend. */
export function Analytics({ ga4Id, pixelId }: { ga4Id?: string | null; pixelId?: string | null }) {
  useEffect(() => {
    function load() {
      if (getConsent() !== 'yes') return;
      const w = window as unknown as { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void; fbq?: ((...a: unknown[]) => void) & { callMethod?: unknown; queue?: unknown[]; loaded?: boolean; version?: string } };

      if (ga4Id && !document.getElementById('ga4-src')) {
        const s = document.createElement('script');
        s.id = 'ga4-src';
        s.async = true;
        s.src = `https://www.googletagmanager.com/gtag/js?id=${ga4Id}`;
        document.head.appendChild(s);
        w.dataLayer = w.dataLayer || [];
        w.gtag = function gtag() {
          // eslint-disable-next-line prefer-rest-params
          w.dataLayer!.push(arguments);
        };
        w.gtag('js', new Date());
        w.gtag('config', ga4Id);
      }

      if (pixelId && !document.getElementById('fbq-src')) {
        /* Meta Pixel bootstrap */
        const n = (function () {
          const f = w as unknown as { fbq?: { callMethod?: (...a: unknown[]) => void; queue: unknown[]; push?: unknown; loaded?: boolean; version?: string } };
          const fbq: ((...a: unknown[]) => void) & { callMethod?: (...a: unknown[]) => void; queue: unknown[]; loaded?: boolean; version?: string } = function (...args: unknown[]) {
            fbq.callMethod ? fbq.callMethod(...args) : fbq.queue.push(args);
          } as never;
          fbq.queue = [];
          fbq.loaded = true;
          fbq.version = '2.0';
          (w as unknown as { fbq: unknown }).fbq = fbq;
          return fbq;
        })();
        const s = document.createElement('script');
        s.id = 'fbq-src';
        s.async = true;
        s.src = 'https://connect.facebook.net/en_US/fbevents.js';
        document.head.appendChild(s);
        n('init', pixelId);
        n('track', 'PageView');
      }
    }
    load();
    window.addEventListener(CONSENT_EVENT, load);
    return () => window.removeEventListener(CONSENT_EVENT, load);
  }, [ga4Id, pixelId]);

  return null;
}

export function ConsentBanner() {
  const t = useTranslations('common');
  const [show, setShow] = useState(false);
  useEffect(() => setShow(getConsent() === null), []);
  if (!show) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] border-t border-white/10 bg-navy-900 text-soft">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-4 py-3 text-sm sm:flex-row">
        <p className="text-center sm:text-start">{t('consentText')}</p>
        <div className="flex flex-none gap-2">
          <button onClick={() => { setConsent('no'); setShow(false); }} className="rounded-lg px-4 py-1.5 text-white/70 hover:text-white">{t('consentDecline')}</button>
          <button onClick={() => { setConsent('yes'); setShow(false); }} className="rounded-lg bg-gold px-4 py-1.5 font-bold text-navy-900">{t('consentAccept')}</button>
        </div>
      </div>
    </div>
  );
}
