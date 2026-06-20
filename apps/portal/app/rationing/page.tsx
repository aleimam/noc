import { getLocale, getTranslations } from 'next-intl/server';
import { auth } from '@noc/auth';
import { prisma, Prisma } from '@noc/db';
import { RegisterForm } from './RegisterForm';
import { FoundResults } from './FoundResults';

export const dynamic = 'force-dynamic';

function fmtDate(d: Date | null, locale: string) {
  if (!d) return '—';
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export default async function RationingSearch({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = (typeof sp.q === 'string' ? sp.q : '').trim();
  const locale = (await getLocale()) as 'ar' | 'en';
  const t = await getTranslations('rationing');

  let results: Awaited<ReturnType<typeof prisma.rationingSheet.findMany>> = [];
  const searched = q.length > 0;
  if (searched) {
    const where: Prisma.RationingSheetWhereInput = {
      OR: [
        { ownerName: { contains: q } },
        { originalPiece: { contains: q } },
        { originalLocation: { contains: q } },
        { originalMember: { contains: q } },
        { company: { contains: q } },
        { numberInSheet: { contains: q } },
      ],
    };
    results = await prisma.rationingSheet.findMany({ where, take: 50, orderBy: { ownerName: 'asc' } });

    // Log every search for admin review ("List of Sheets Inquiries").
    const session = await auth();
    await prisma.sheetSearchLog.create({
      data: { query: q, resultsCount: results.length, matched: results.length > 0, userId: session?.user?.id ?? null },
    });
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <a href="/" className="text-sm text-accent">← {t('backHome')}</a>
      <div>
        <h1 className="text-2xl font-bold text-primary">{t('searchTitle')}</h1>
        <p className="text-sm opacity-70">{t('searchSubtitle')}</p>
      </div>

      <form method="get" className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder={t('searchPlaceholder')}
          className="flex-1 rounded-md border border-graphite/20 bg-transparent px-3 py-2 text-sm"
        />
        <button className="rounded-md bg-primary px-5 py-2 text-sm text-soft">{t('search')}</button>
      </form>

      {searched && results.length > 0 && (
        <FoundResults
          rows={results.map((s) => ({
            id: s.id,
            numberInSheet: s.numberInSheet,
            ownerName: s.ownerName,
            company: s.company,
            originalPiece: s.originalPiece,
            originalLocation: s.originalLocation,
            originalMember: s.originalMember,
            sheetDateLabel: fmtDate(s.sheetDate, locale),
          }))}
        />
      )}

      {searched && results.length === 0 && (
        <div className="rounded-lg border border-gold/50 bg-gold/5 p-4">
          <p className="font-semibold">{t('noMatches')}</p>
          <p className="mb-3 mt-1 text-sm">{t('notFoundCta')}</p>
          <RegisterForm kind="NOT_FOUND_WATCH" defaultOwnerName={q} />
        </div>
      )}
    </main>
  );
}
