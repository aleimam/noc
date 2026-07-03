import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma, Prisma } from '@noc/db';
import { ImportSheets, DeleteBatchButton } from '../SheetsClient';

export const dynamic = 'force-dynamic';

const PER = 50;
const str = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '').trim();
const num = (v: string | string[] | undefined) => {
  const n = parseInt(str(v), 10);
  return Number.isNaN(n) ? null : n;
};

function fmtDate(d: Date | null, locale: string) {
  if (!d) return '—';
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

type Sort = 'newest' | 'name' | 'plot' | 'listDate';

export default async function SheetsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePermission('sheets', 'VIEW');
  const t = await getTranslations('rationing');
  const locale = (await getLocale()) as 'ar' | 'en';
  const sp = await searchParams;

  const q = str(sp.q);
  const cityId = str(sp.city);
  const review = str(sp.review) === '1';
  const sort = (['newest', 'name', 'plot', 'listDate'].includes(str(sp.sort)) ? str(sp.sort) : 'newest') as Sort;
  const page = Math.max(1, num(sp.page) ?? 1);

  const where: Prisma.RationingSheetWhereInput = {
    ...(cityId ? { cityId } : {}),
    ...(review ? { needsReview: true } : {}),
    ...(q
      ? {
          OR: [
            { applicantName: { contains: q } },
            { originalOwner: { contains: q } },
            { plotNo: { contains: q } },
            { blockNo: { contains: q } },
            { plotFullRef: { contains: q } },
          ],
        }
      : {}),
  };
  const orderBy: Prisma.RationingSheetOrderByWithRelationInput | Prisma.RationingSheetOrderByWithRelationInput[] =
    sort === 'name' ? { applicantName: 'asc' } : sort === 'plot' ? [{ blockNo: 'asc' }, { plotNo: 'asc' }] : sort === 'listDate' ? { listDate: 'desc' } : { createdAt: 'desc' };

  const [grandTotal, total, cities, batches, sheets] = await Promise.all([
    prisma.rationingSheet.count(),
    prisma.rationingSheet.count({ where }),
    prisma.rationingCity.findMany({ orderBy: [{ order: 'asc' }, { name: 'asc' }], select: { id: true, name: true } }),
    prisma.sheetImportBatch.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.rationingSheet.findMany({ where, orderBy, skip: (page - 1) * PER, take: PER, include: { city: true } }),
  ]);
  const totalPages = Math.ceil(total / PER);

  // Build hrefs preserving the current query.
  const build = (over: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const set = (k: string, v: string | number | undefined) => { if (v !== undefined && v !== '' && v !== null) p.set(k, String(v)); };
    const cur = { q, city: cityId, review: review ? '1' : '', sort: sort !== 'newest' ? sort : '', page: page > 1 ? page : '', ...over };
    set('q', cur.q); set('city', cur.city); set('review', cur.review); set('sort', cur.sort); set('page', cur.page);
    const s = p.toString();
    return `/admin/rationing/sheets${s ? `?${s}` : ''}`;
  };
  const sortHref = (s: Sort) => build({ sort: s === 'newest' ? undefined : s, page: undefined });
  const arrow = (s: Sort) => (sort === s ? ' ▾' : '');
  const active = !!q || !!cityId || review;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">
          {t('sheets')} <span className="text-base font-normal opacity-60">({active ? `${total} / ${grandTotal}` : grandTotal})</span>
        </h1>
        <a href="/admin/rationing" className="text-sm text-accent">← {t('title')}</a>
      </div>

      <div className="flex flex-wrap gap-2">
        <a href="/admin/rationing/sheets/export" className="rounded-md border border-graphite/25 px-3 py-1.5 text-sm hover:bg-graphite/10">⬇ {t('exportRecords')}</a>
        <a href="/admin/rationing/sheets/export-plots" className="rounded-md border border-graphite/25 px-3 py-1.5 text-sm hover:bg-graphite/10">⬇ {t('exportPlots')}</a>
      </div>

      <ImportSheets />

      {batches.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">{t('batches')}</h2>
          <div className="overflow-x-auto rounded-lg border border-graphite/15">
            <table className="w-full text-sm">
              <thead>
                <tr className="opacity-60">
                  <th className="p-2 text-start">{t('fileName')}</th>
                  <th className="p-2 text-start">{t('rows')}</th>
                  <th className="p-2 text-start">{t('willAdd')}</th>
                  <th className="p-2 text-start">{t('updated')}</th>
                  <th className="p-2 text-start">{t('duplicates')}</th>
                  <th className="p-2 text-start">{t('uploadedAt')}</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} className="border-t border-graphite/10">
                    <td className="p-2">{b.fileName}</td>
                    <td className="p-2">{b.rowCount}</td>
                    <td className="p-2 text-green">{b.createdCount}</td>
                    <td className="p-2">{b.updatedCount}</td>
                    <td className="p-2 opacity-70">{b.duplicateCount}</td>
                    <td className="p-2" dir="ltr">{fmtDate(b.createdAt, locale)}</td>
                    <td className="p-2 text-end"><DeleteBatchButton id={b.id} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="space-y-3">
        {/* Search + filter (GET form) */}
        <form method="get" className="flex flex-wrap items-end gap-2">
          <label className="text-sm">{t('search')}
            <input name="q" defaultValue={q} placeholder={t('plotsSearchPh')} className="block w-64 rounded-md border border-graphite/20 bg-transparent px-3 py-2 text-sm" />
          </label>
          <label className="text-sm">{t('colCity')}
            <select name="city" defaultValue={cityId} className="block rounded-md border border-graphite/20 bg-transparent px-3 py-2 text-sm">
              <option value="">{t('allCities')}</option>
              {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          {sort !== 'newest' && <input type="hidden" name="sort" value={sort} />}
          <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="review" value="1" defaultChecked={review} /> {t('needsReview')}</label>
          <button className="rounded-md bg-primary px-4 py-2 text-sm text-soft">{t('search')}</button>
          {active && <a href="/admin/rationing/sheets" className="rounded-md border border-graphite/25 px-3 py-2 text-sm">{t('cancel')}</a>}
        </form>

        {sheets.length === 0 ? (
          <p className="py-12 text-center opacity-60">{t('noSheets')}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-graphite/15">
            <table className="w-full whitespace-nowrap text-sm">
              <thead>
                <tr className="opacity-60">
                  <th className="p-2 text-start"><a href={sortHref('name')} className="hover:text-accent">{t('colApplicant')}{arrow('name')}</a></th>
                  <th className="p-2 text-start"><a href={sortHref('plot')} className="hover:text-accent">{t('colPlot')}{arrow('plot')}</a></th>
                  <th className="p-2 text-start">{t('colBlock')}</th>
                  <th className="p-2 text-start">{t('colCity')}</th>
                  <th className="p-2 text-start">{t('colOwner')}</th>
                  <th className="p-2 text-start"><a href={sortHref('listDate')} className="hover:text-accent">{t('colListDate')}{arrow('listDate')}</a></th>
                  <th className="p-2 text-start">{t('colRemarks')}</th>
                </tr>
              </thead>
              <tbody>
                {sheets.map((s) => (
                  <tr key={s.id} className="border-t border-graphite/10">
                    <td className="p-2 font-medium">
                      {s.applicantName}
                      {s.needsReview && <span className="ms-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">{t('needsReview')}</span>}
                    </td>
                    <td className="p-2">{s.plotNo}</td>
                    <td className="p-2">{s.blockNo || '—'}</td>
                    <td className="p-2">{s.city?.name ?? '—'}</td>
                    <td className="p-2">{s.originalOwner ?? '—'}</td>
                    <td className="p-2" dir="ltr">{fmtDate(s.listDate, locale)}</td>
                    <td className="max-w-[16rem] truncate p-2 opacity-70">{s.remarks ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 text-sm">
            {page > 1 && <a href={build({ page: page - 1 })} className="rounded-lg border border-ink-200 px-4 py-2">{t('prev')}</a>}
            <span className="opacity-60">{t('pageOf', { page, total: totalPages })}</span>
            {page < totalPages && <a href={build({ page: page + 1 })} className="rounded-lg border border-ink-200 px-4 py-2">{t('next')}</a>}
          </div>
        )}
      </section>
    </div>
  );
}
