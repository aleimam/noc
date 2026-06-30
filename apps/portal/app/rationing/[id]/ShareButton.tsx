'use client';

import { useTranslations } from 'next-intl';

export function ShareButton({ text }: { text: string }) {
  const t = useTranslations('rationing');
  function share() {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const msg = encodeURIComponent(`${text}\n${url}`);
    window.open(`https://wa.me/?text=${msg}`, '_blank', 'noopener');
  }
  return (
    <button onClick={share} className="inline-flex items-center gap-2 rounded-xl bg-success-soft px-4 py-2.5 text-sm font-bold text-success">
      <span aria-hidden>🟢</span> {t('share')}
    </button>
  );
}
