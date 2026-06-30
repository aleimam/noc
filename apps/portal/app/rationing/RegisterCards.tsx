import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

// Two always-visible engagement cards (req #12). Both route into the account-gated
// follow flow (login is enforced there). The watch card prefills the name from the query.
export async function RegisterCards({ q }: { q?: string }) {
  const t = await getTranslations('rationing');
  const watchHref = `/rationing/follow?kind=watch${q ? `&q=${encodeURIComponent(q)}` : ''}`;
  return (
    <div className="grid gap-3.5 pt-2 sm:grid-cols-2">
      <div className="rounded-2xl border-2 border-green bg-white p-5">
        <div className="flex items-center gap-2.5 text-lg font-extrabold text-success">
          <span aria-hidden>🔔</span> {t('foundCardTitle')}
        </div>
        <p className="mt-2 text-ink-600">{t('foundCardBody')}</p>
        <Link href="/rationing/follow?kind=found" className="mt-3.5 inline-block rounded-xl bg-navy px-5 py-2.5 font-bold text-soft">
          {t('foundCardCta')}
        </Link>
      </div>
      <div className="rounded-2xl border-2 border-gold bg-white p-5">
        <div className="flex items-center gap-2.5 text-lg font-extrabold text-gold-800">
          <span aria-hidden>🔎</span> {t('notFoundCardTitle')}
        </div>
        <p className="mt-2 text-ink-600">{t('notFoundCardBody')}</p>
        <Link href={watchHref} className="mt-3.5 inline-block rounded-xl bg-gold px-5 py-2.5 font-bold text-navy-900">
          {t('notFoundCardCta')}
        </Link>
      </div>
    </div>
  );
}
