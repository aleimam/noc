'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * Thin top progress bar for client-side navigations. Replaces the old full-screen `loading.tsx`
 * takeover: the current page stays on screen while the next one loads, and only a slim bar at the
 * very top shows that something is happening — so a normal navigation no longer looks like a
 * "transit page" (and a slow one no longer looks frozen).
 *
 * Dependency-free. It STARTS on internal-link clicks, back/forward, and router `pushState`, and
 * FINISHES when the committed route (pathname/search) actually changes. A safety timeout guarantees
 * the bar never gets stuck. RTL-safe (uses logical inset properties).
 *
 * `useSearchParams()` must live under a Suspense boundary (Next build requirement for any statically
 * rendered page under this root-layout component), so the exported wrapper provides one.
 */
export function NavProgress() {
  return (
    <Suspense fallback={null}>
      <NavProgressBar />
    </Suspense>
  );
}

function NavProgressBar() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const activeRef = useRef(false);
  const trickleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const safetyRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRef = useRef(true);

  const clearTimers = () => {
    if (trickleRef.current) clearInterval(trickleRef.current);
    if (safetyRef.current) clearTimeout(safetyRef.current);
    trickleRef.current = null;
    safetyRef.current = null;
  };

  const start = () => {
    if (activeRef.current) return;
    activeRef.current = true;
    if (doneRef.current) { clearTimeout(doneRef.current); doneRef.current = null; }
    setVisible(true);
    setWidth(8);
    // Trickle toward (but never reach) 90% so a slow render keeps showing motion.
    trickleRef.current = setInterval(() => setWidth((w) => (w < 90 ? w + (90 - w) * 0.1 : w)), 220);
    // Never leave the bar stuck if a "finish" signal never arrives.
    safetyRef.current = setTimeout(end, 10000);
  };

  const end = () => {
    if (!activeRef.current) return;
    activeRef.current = false;
    clearTimers();
    setWidth(100);
    doneRef.current = setTimeout(() => { setVisible(false); setWidth(0); }, 260);
  };

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.('a');
      if (!a) return;
      if (a.getAttribute('target') === '_blank' || a.hasAttribute('download')) return;
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      let u: URL;
      try { u = new URL(href, location.href); } catch { return; }
      if (u.origin !== location.origin) return;
      if (u.pathname === location.pathname && u.search === location.search) return; // same page
      start();
    };
    const onPop = () => start();

    // Catch programmatic navigations (router.push from filters/sorts) that aren't link clicks.
    const origPush = history.pushState;
    const patched: History['pushState'] = function (this: History, ...args) {
      try {
        const next = args[2];
        if (next != null) {
          const u = new URL(String(next), location.href);
          if (u.pathname !== location.pathname || u.search !== location.search) start();
        }
      } catch { /* ignore */ }
      return origPush.apply(this, args);
    };
    history.pushState = patched;

    document.addEventListener('click', onClick, true);
    window.addEventListener('popstate', onPop);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('popstate', onPop);
      history.pushState = origPush;
      clearTimers();
      if (doneRef.current) clearTimeout(doneRef.current);
    };
  }, []);

  // Committed route changed → finish (no-op if we never started, e.g. first paint).
  useEffect(() => {
    if (firstRef.current) { firstRef.current = false; return; }
    end();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search]);

  if (!visible) return null;
  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        insetBlockStart: 0,
        insetInlineStart: 0,
        height: 3,
        width: `${width}%`,
        zIndex: 9999,
        background: 'var(--color-gold, #c9983e)',
        boxShadow: '0 0 8px 0 var(--color-gold, #c9983e)',
        transition: 'width 0.2s ease',
        pointerEvents: 'none',
      }}
    />
  );
}
