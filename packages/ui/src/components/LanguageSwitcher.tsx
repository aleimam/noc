'use client';

import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';

const LOCALE_COOKIE = 'NEXT_LOCALE';
// Short, self-labelling toggle (shows both, highlights the current): En / العربية.
const LABELS: Record<'ar' | 'en', string> = { ar: 'العربية', en: 'En' };

export function LanguageSwitcher() {
  const router = useRouter();
  const locale = useLocale();

  function switchTo(next: 'ar' | 'en') {
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
    // Persist for signed-in customers (ignored otherwise).
    void fetch('/api/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: next }),
    }).catch(() => {});
    router.refresh();
  }

  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-current/20 p-0.5 text-sm">
      {(['ar', 'en'] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => switchTo(code)}
          aria-pressed={locale === code}
          className={
            locale === code
              ? 'rounded-md bg-gold px-2.5 py-1 font-bold text-navy-900'
              : 'rounded-md px-2.5 py-1 opacity-70 hover:opacity-100'
          }
        >
          {LABELS[code]}
        </button>
      ))}
    </div>
  );
}
