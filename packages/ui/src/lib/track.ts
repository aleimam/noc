'use client';

// Lightweight analytics helpers. Events are no-ops until GA4/Pixel are loaded
// (which only happens after the visitor accepts the consent banner).
export const CONSENT_COOKIE = 'noc_consent';
export const CONSENT_EVENT = 'noc-consent';

export function getConsent(): 'yes' | 'no' | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(/(?:^|; )noc_consent=(yes|no)/);
  return m ? (m[1] as 'yes' | 'no') : null;
}

export function setConsent(v: 'yes' | 'no') {
  document.cookie = `${CONSENT_COOKIE}=${v};path=/;max-age=31536000;samesite=lax`;
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

/** Fire a conversion event to GA4 + Meta Pixel if they're loaded. Safe to call anytime. */
export function track(event: string, params: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return;
  const w = window as unknown as { gtag?: (...a: unknown[]) => void; fbq?: (...a: unknown[]) => void };
  try {
    w.gtag?.('event', event, params);
    w.fbq?.('trackCustom', event, params);
  } catch {
    /* ignore */
  }
}
