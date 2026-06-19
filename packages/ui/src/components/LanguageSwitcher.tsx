'use client';

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';

const LOCALE_COOKIE = 'NEXT_LOCALE';

export function LanguageSwitcher() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('common');

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
    <div className="inline-flex items-center gap-1 rounded-md border border-graphite/20 p-0.5 text-sm">
      {(['ar', 'en'] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => switchTo(code)}
          aria-pressed={locale === code}
          className={
            locale === code
              ? 'rounded bg-primary px-2 py-1 text-soft'
              : 'rounded px-2 py-1 hover:bg-graphite/10'
          }
        >
          {code === 'ar' ? t('arabic') : t('english')}
        </button>
      ))}
    </div>
  );
}
