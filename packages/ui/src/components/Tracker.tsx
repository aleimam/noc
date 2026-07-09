'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// First-party, always-on (anonymized) page/behaviour tracker. Manages a first-party
// visitor id + a 30-min session id in localStorage and beacons pageviews, page-leaves
// (with time-on-page + scroll depth), and manual events to the app's /api/collect.
// Admin pages are excluded (staff backend, not "visitors").

const SESSION_MS = 30 * 60 * 1000;

function uid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
}
function getVid(): string {
  try {
    let v = localStorage.getItem('noc_vid');
    if (!v) { v = uid(); localStorage.setItem('noc_vid', v); }
    return v;
  } catch { return uid(); }
}
function getSid(): string {
  try {
    const now = Date.now();
    const exp = Number(localStorage.getItem('noc_sid_exp') || 0);
    let s = localStorage.getItem('noc_sid');
    if (!s || now > exp) { s = uid(); localStorage.setItem('noc_sid', s); }
    localStorage.setItem('noc_sid_exp', String(now + SESSION_MS));
    return s;
  } catch { return uid(); }
}

export function Tracker({ site, url = '/api/collect' }: { site: 'newobour' | 'alsawarey'; url?: string }) {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (pathname?.startsWith('/admin')) return; // don't track the staff backend

    const state = { id: uid(), start: Date.now(), maxScroll: 0, sent: false };

    function send(payload: Record<string, unknown>) {
      try {
        const body = JSON.stringify({ site, vid: getVid(), sid: getSid(), ...payload });
        const blob = new Blob([body], { type: 'text/plain' });
        if (navigator.sendBeacon && navigator.sendBeacon(url, blob)) return;
        void fetch(url, { method: 'POST', body, keepalive: true, headers: { 'content-type': 'text/plain' } }).catch(() => {});
      } catch { /* ignore */ }
    }
    function utm() {
      try {
        const p = new URLSearchParams(location.search);
        const s = p.get('utm_source'), m = p.get('utm_medium'), c = p.get('utm_campaign');
        if (s || m || c) return { source: s || undefined, medium: m || undefined, campaign: c || undefined };
      } catch { /* */ }
      return undefined;
    }
    function externalRef() {
      try {
        const r = document.referrer;
        if (!r || new URL(r).hostname === location.hostname) return undefined;
        return r;
      } catch { return undefined; }
    }
    function loadMs() {
      try {
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
        return nav && nav.loadEventEnd > 0 ? Math.round(nav.loadEventEnd) : undefined;
      } catch { return undefined; }
    }
    function leave() {
      if (state.sent) return;
      state.sent = true;
      send({ type: 'pageleave', pvId: state.id, durationSec: Math.round((Date.now() - state.start) / 1000), scrollPct: state.maxScroll });
    }

    send({
      type: 'pageview', pvId: state.id, path: location.pathname + location.search, title: document.title,
      ref: externalRef(), utm: utm(), screen: `${screen.width}x${screen.height}`, lang: navigator.language, loadMs: loadMs(),
    });

    const onScroll = () => {
      try {
        const h = document.documentElement;
        const d = h.scrollHeight - h.clientHeight || 1;
        const p = Math.min(100, Math.round((h.scrollTop / d) * 100));
        if (p > state.maxScroll) state.maxScroll = p;
      } catch { /* */ }
    };
    const onVis = () => { if (document.visibilityState === 'hidden') leave(); };
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', leave);
    // Rage clicks (frustration signal): ≥3 clicks within 700ms in a ~40px radius.
    const recent: { t: number; x: number; y: number }[] = [];
    const onClick = (e: MouseEvent) => {
      const now = Date.now();
      recent.push({ t: now, x: e.clientX, y: e.clientY });
      while (recent.length && now - recent[0]!.t > 700) recent.shift();
      if (recent.length >= 3 && recent.every((c) => Math.abs(c.x - e.clientX) < 40 && Math.abs(c.y - e.clientY) < 40)) {
        recent.length = 0;
        send({ type: 'event', eventType: 'rage_click', path: location.pathname });
      }
    };
    window.addEventListener('click', onClick, true);
    // Manual event API: window.nocTrack('contact_whatsapp', label?, value?, meta?)
    (window as unknown as { nocTrack?: unknown }).nocTrack = (type: string, label?: string, value?: number, meta?: unknown) =>
      send({ type: 'event', eventType: type, path: location.pathname, label, value, meta });

    return () => {
      leave();
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', leave);
      window.removeEventListener('click', onClick, true);
    };
  }, [pathname, site, url]);

  // Core Web Vitals (LCP + CLS), reported once on the first page-hide.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') return;
    let lcp = 0, cls = 0, reported = false;
    const obs: PerformanceObserver[] = [];
    const observe = (type: string, cb: (e: PerformanceEntry) => void) => {
      try {
        const po = new PerformanceObserver((l) => l.getEntries().forEach(cb));
        po.observe({ type, buffered: true } as PerformanceObserverInit);
        obs.push(po);
      } catch { /* metric unsupported in this browser */ }
    };
    observe('largest-contentful-paint', (e) => {
      const t = (e as unknown as { renderTime?: number; loadTime?: number });
      lcp = Math.max(lcp, t.renderTime || t.loadTime || e.startTime);
    });
    observe('layout-shift', (e) => {
      const s = e as unknown as { value: number; hadRecentInput: boolean };
      if (!s.hadRecentInput) cls += s.value;
    });
    const report = () => {
      if (reported) return;
      reported = true;
      if (lcp > 0) nocEvent('web_vital', 'LCP', Math.round(lcp));
      nocEvent('web_vital', 'CLS', Math.round(cls * 1000) / 1000);
    };
    const onHide = () => { if (document.visibilityState === 'hidden') report(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', report);
    return () => {
      obs.forEach((o) => o.disconnect());
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', report);
    };
  }, []);

  return null;
}

/** Fire a first-party interaction event from a client handler (contact, wishlist, …). */
export function nocEvent(type: string, label?: string, value?: number, meta?: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    (window as unknown as { nocTrack?: (t: string, l?: string, v?: number, m?: unknown) => void }).nocTrack?.(type, label, value, meta);
  } catch {
    /* ignore */
  }
}

/** Server-rendered event that fires once on mount (e.g. a search result + its count). Polls
 *  briefly for the tracker to be ready so it isn't lost in the effect mount-order race. */
export function TrackEvent({ type, label, value }: { type: string; label?: string; value?: number }) {
  useEffect(() => {
    let tries = 0;
    const fire = () => {
      const fn = (window as unknown as { nocTrack?: (t: string, l?: string, v?: number) => void }).nocTrack;
      if (fn) return void fn(type, label, value);
      if (tries++ < 20) window.setTimeout(fire, 100);
    };
    fire();
  }, [type, label, value]);
  return null;
}
