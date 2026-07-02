import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

// Two big, full-width engagement cards (Golden Rule: large, obvious, one action each).
// Both route into the account-gated follow flow. The watch card prefills the query name.
export async function RegisterCards({ q, foundSheetId }: { q?: string; foundSheetId?: string }) {
  const t = await getTranslations('rationing');
  const watchHref = `/rationing/follow?kind=watch${q ? `&q=${encodeURIComponent(q)}` : ''}`;
  const foundHref = `/rationing/follow?kind=found${foundSheetId ? `&sheet=${foundSheetId}` : ''}`;
  return (
    <div className="grid gap-4 pt-2 sm:grid-cols-2">
      {/* Found → congrats */}
      <div className="flex flex-col rounded-3xl border-2 border-green bg-green/5 p-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green/15 text-4xl" aria-hidden>🎉</div>
        <div className="mt-3 text-2xl font-black text-success">{t('foundCardTitle')}</div>
        <p className="mt-2 flex-1 text-ink-600">{t('foundCardBody')}</p>
        <Link
          href={foundHref}
          className="mt-4 block rounded-2xl bg-green px-5 py-4 text-xl font-bold text-white transition hover:brightness-105"
        >
          {t('foundCardCta')}
        </Link>
      </div>

      {/* Not found yet → watch */}
      <div className="flex flex-col rounded-3xl border-2 border-gold bg-gold-50 p-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gold/20 text-4xl" aria-hidden>🔔</div>
        <div className="mt-3 text-2xl font-black text-gold-800">{t('notFoundCardTitle')}</div>
        <p className="mt-2 flex-1 text-ink-600">{t('notFoundCardBody')}</p>
        <Link
          href={watchHref}
          className="mt-4 block rounded-2xl bg-gold px-5 py-4 text-xl font-bold text-navy-900 transition hover:brightness-105"
        >
          {t('notFoundCardCta')}
        </Link>
      </div>
    </div>
  );
}
