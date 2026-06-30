import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@noc/db';
import { SiteShell } from '../../_components/SiteShell';

export const dynamic = 'force-dynamic';
const str = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '').trim();

export default async function PlotDetail({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const ref = str(sp.ref);
  const t = await getTranslations('rationing');
  if (!ref) notFound();

  const sheets = await prisma.rationingSheet.findMany({
    where: { plotFullRef: ref },
    orderBy: { applicantName: 'asc' },
    take: 1000,
    include: { city: { select: { name: true } } },
  });
  if (sheets.length === 0) notFound();
  const first = sheets[0]!;

  return (
    <SiteShell active="rationing">
      <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
        <Link href="/rationing/plots" className="inline-block text-sm text-navy-600">‹ {t('tabPlots')}</Link>

        <div className="rounded-2xl bg-navy-800 p-5 text-white">
          <div className="font-num text-2xl font-extrabold">{ref}</div>
          <div className="mt-1 text-navy-200">
            {first.city?.name ?? ''}
            {first.originalOwner ? ` · ${t('ownerLabelShort')} ${first.originalOwner}` : ''}
            {` · ${t('colApplicantsCount')}: `}<span className="font-num">{sheets.length}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {sheets.map((s) => (
            <Link
              key={s.id}
              href={`/rationing/${s.id}`}
              className="flex items-center gap-3.5 rounded-xl border border-ink-200 bg-white p-4 transition hover:border-gold hover:shadow-md"
            >
              <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-navy-50 text-xl text-navy-600" aria-hidden>☻</div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xl font-bold text-navy-800">{s.applicantName}</div>
              </div>
              <span className="flex-none text-2xl text-gold" aria-hidden>‹</span>
            </Link>
          ))}
        </div>
      </div>
    </SiteShell>
  );
}
