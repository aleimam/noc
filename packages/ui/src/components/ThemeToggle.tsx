'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

// Keep this cookie name in sync with ThemeScript.
const THEME_COOKIE = 'NOC_THEME';
type Appearance = 'light' | 'dark';

export function ThemeToggle() {
  const t = useTranslations('common');
  const [theme, setTheme] = useState<Appearance>('light');

  useEffect(() => {
    setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  }, []);

  function toggle() {
    const next: Appearance = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.classList.toggle('dark', next === 'dark');
    document.cookie = `${THEME_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
    // Persist for signed-in customers (ignored otherwise).
    void fetch('/api/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appearance: next.toUpperCase() }),
    }).catch(() => {});
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t('appearance')}
      className="rounded-md border border-graphite/20 px-2 py-1 text-sm hover:bg-graphite/10"
    >
      {theme === 'dark' ? t('themeLight') : t('themeDark')}
    </button>
  );
}
