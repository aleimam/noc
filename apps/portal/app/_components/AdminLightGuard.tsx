'use client';

import { useEffect } from 'react';

// Admin has no dark mode. On full loads ThemeScript already skips `/admin`, but a
// client-side navigation from a dark public page would carry the `.dark` class over —
// so strip it whenever any admin screen mounts. Renders nothing.
export function AdminLightGuard() {
  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);
  return null;
}
