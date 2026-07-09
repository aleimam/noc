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
    // Manual event API: window.nocTrack('contact_whatsapp', label?, value?, meta?)
    (window as unknown as { nocTrack?: unknown }).nocTrack = (type: string, label?: string, value?: number, meta?: unknown) =>
      send({ type: 'event', eventType: type, path: location.pathname, label, value, meta });

    return () => {
      leave();
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', leave);
    };
  }, [pathname, site, url]);

  return null;
}
