import { getTranslations } from 'next-intl/server';

type Totals = { owners: number; plots: number; scans: number; latestListDate: string | null };

// Shared pre-search summary card (applicants / plots / uploaded sheets) — used on the
// main rationing page and the plots tab so both show the same "إجمالي بيانات التقنين" card.
export async function TotalsCard({ totals }: { totals: Totals }) {
  const t = await getTranslations('rationing');
  const items = [
    { value: totals.owners, label: t('statApplicants') },
    { value: totals.plots, label: t('statPlots') },
    { value: totals.scans, label: t('statSheets') },
  ];
  return (
    <div className="rounded-3xl bg-navy-800 p-6 text-white">
      <div className="text-center text-base text-navy-200">
        {t('totalsTitle')}
        {totals.latestListDate ? (
          <>
            {' · '}
            {t('latestList')}: <span className="font-num" dir="ltr">{totals.latestListDate}</span>
          </>
        ) : null}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        {items.map((it) => (
          <div key={it.label}>
            <div className="font-num text-3xl font-black text-gold sm:text-4xl">{it.value.toLocaleString('en')}</div>
            <div className="mt-1 text-sm text-navy-200">{it.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
