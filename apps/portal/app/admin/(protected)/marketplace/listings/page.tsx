import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma, Prisma } from '@noc/db';
import { currency } from '@noc/i18n';
import { missingRequiredForListing } from '@noc/partner-portal/required';
import { resolveListingAssets } from '@noc/partner-portal/assets';
import { ModerationActions } from './ModerationActions';
import { RecentListingsTable, type RecentRow } from './RecentListingsTable';
import { ListingsToolbar } from './ListingsToolbar';

// Force-dynamic: this admin table mutates via server actions and must never be served from a
// cached render — that (with the optimistic client controls) is why buttons no longer need a
// manual page reload to reflect their result.
export const dynamic = 'force-dynamic';

const PER_PAGE = 20;
const ORDER: Record<string, Prisma.ListingOrderByWithRelationInput> = {
  recent: { updatedAt: 'desc' },
  oldest: { updatedAt: 'asc' },
  price_desc: { price: 'desc' },
  price_asc: { price: 'asc' },
  area_desc: { area: 'desc' },
  area_asc: { area: 'asc' },
  title: { title: 'asc' },
};
const VALID_STATUS = new Set(['PUBLISHED', 'ARCHIVED', 'REJECTED', 'SOLD', 'DRAFT']);

export default async function ModerationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePermission('listings', 'VIEW');
  const t = await getTranslations('mp');
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  const sp = await searchParams;
  const get = (k: string) => { const v = sp[k]; return (Array.isArray(v) ? v[0] : v) ?? ''; };
  const q = get('q').trim();
  const statusFilter = VALID_STATUS.has(get('status')) ? get('status') : '';
  const typeFilter = get('type');
  const sort = ORDER[get('sort')] ? get('sort') : 'recent';
  const page = Math.max(1, Number(get('page')) || 1);

  // Pending moderation queue — the workflow section; not filtered/paginated (usually tiny).
  const pending = await prisma.listing.findMany({
    where: { status: 'PENDING', deletedAt: null },
    orderBy: { createdAt: 'asc' },
    include: {
      typeOption: { select: { nameAr: true, nameEn: true } },
      owner: { select: { name: true, phone1: true } },
      seller: { select: { phone: true, name: true } },
    },
  });
  const missingByListing = new Map(
    await Promise.all(pending.map(async (l) => [l.id, await missingRequiredForListing(l.id)] as const)),
  );

  // The main list: filter (search/status/type) + sort + paginate.
  const recentWhere: Prisma.ListingWhereInput = {
    deletedAt: null,
    status: statusFilter ? (statusFilter as Prisma.ListingWhereInput['status']) : { not: 'PENDING' },
    ...(typeFilter ? { typeOptionId: typeFilter } : {}),
    ...(q ? { OR: [{ title: { contains: q } }, { ownerName: { contains: q } }, { owner: { name: { contains: q } } }] } : {}),
  };
  const [recentCount, recent, typeOpts] = await Promise.all([
    prisma.listing.count({ where: recentWhere }),
    prisma.listing.findMany({
      where: recentWhere,
      orderBy: ORDER[sort],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: { typeOption: { select: { nameAr: true, nameEn: true } }, owner: { select: { name: true } } },
    }),
    prisma.classifierOption.findMany({ where: { classifier: { key: 'type' }, isActive: true }, orderBy: { order: 'asc' }, select: { id: true, nameAr: true, nameEn: true } }),
  ]);
  const totalPages = Math.max(1, Math.ceil(recentCount / PER_PAGE));
  const types = typeOpts.map((o) => ({ id: o.id, label: L(o.nameAr, o.nameEn) }));

  const assets = await resolveListingAssets(recent.map((l) => l.id), { branded: true });
  const recentRows: RecentRow[] = recent.map((l) => ({
    id: l.id,
    title: l.title,
    typeLabel: L(l.typeOption?.nameAr ?? '', l.typeOption?.nameEn ?? ''),
    area: l.area != null ? Number(l.area) : null,
    ownerName: l.owner?.name ?? l.ownerName ?? '—',
    status: l.status,
    featured: l.featured,
    showOnBrokerage: l.showOnBrokerage,
    posterUrl: assets.get(l.id)?.posterUrl ?? null,
    mapUrl: assets.get(l.id)?.mapUrl ?? null,
  }));

  // Build a page URL that keeps the active filters/sort (server-rendered pagination links).
  const pageHref = (n: number) => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (statusFilter) p.set('status', statusFilter);
    if (typeFilter) p.set('type', typeFilter);
    if (sort !== 'recent') p.set('sort', sort);
    if (n > 1) p.set('page', String(n));
    const s = p.toString();
    return s ? `?${s}` : '?';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('moderation')}</h1>
        <div className="flex items-center gap-3">
          <a href="/admin/marketplace/listings/new" className="rounded-md bg-primary px-3 py-1.5 text-sm text-soft">+ {t('addLand')}</a>
          <a href="/admin/marketplace/listings/deleted" className="text-sm opacity-70 hover:opacity-100">🗑️ {L('المحذوفات', 'Trash')}</a>
          <a href="/admin/marketplace" className="text-sm text-accent">← {t('title')}</a>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold">{t('statusPENDING')} ({pending.length})</h2>
        {pending.length === 0 && <p className="text-sm opacity-60">{L('لا توجد إعلانات بعد', 'No listings yet')}</p>}
        {pending.map((l) => (
          <div key={l.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gold/40 p-3">
            <div>
              <div className="font-semibold">{l.title}</div>
              <div className="text-xs opacity-70">
                {L(l.typeOption?.nameAr ?? '', l.typeOption?.nameEn ?? '')}
                {l.price != null ? ` · ${String(l.price)} ${currency(locale)}` : ''} · {t('owner')}: {l.owner?.name ?? l.ownerName ?? '—'}
                {l.owner?.phone1 ? <span dir="ltr"> ({l.owner.phone1})</span> : ''} · {t('seller')}: <span dir="ltr">{l.seller.phone ?? l.seller.name}</span> · {l.contactPhone}
              </div>
              {(missingByListing.get(l.id) ?? []).length > 0 && (
                <div className="mt-2 rounded-md border border-red-600/40 bg-red-50 p-2 text-xs">
                  <span className="font-bold text-red-700">
                    ⚠️ {L('لا يمكن النشر — بيانات مطلوبة ناقصة:', 'Cannot publish — required details missing:')}
                  </span>{' '}
                  <span className="text-red-700">
                    {(missingByListing.get(l.id) ?? []).map((m) => (locale === 'ar' ? m.labelAr : m.labelEn)).join('، ')}
                  </span>{' '}
                  <a href={`/admin/marketplace/listings/${l.id}/edit`} className="font-bold text-accent underline">
                    {L('أكمِل البيانات', 'Complete it')}
                  </a>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <a href={`/admin/marketplace/listings/${l.id}/edit`} className="text-sm text-accent">{t('edit')}</a>
              <ModerationActions id={l.id} incomplete={(missingByListing.get(l.id) ?? []).length > 0} />
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold opacity-70">{L('كل الإعلانات', 'All listings')}</h2>
        <ListingsToolbar types={types} total={recentCount} />
        {/* key = the active query, so the optimistic client table remounts with fresh rows when a
            filter/sort/page changes (useState would otherwise keep the first page's rows). */}
        <RecentListingsTable key={`${statusFilter}|${typeFilter}|${sort}|${q}|${page}`} rows={recentRows} />
        {recentCount === 0 && <p className="p-4 text-center text-sm opacity-60">{L('لا توجد نتائج مطابقة', 'No matching results')}</p>}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-1 text-sm">
            {page > 1 ? (
              <a href={pageHref(page - 1)} className="rounded border border-graphite/20 px-3 py-1 text-accent">← {L('السابق', 'Prev')}</a>
            ) : (
              <span className="rounded border border-graphite/10 px-3 py-1 opacity-30">← {L('السابق', 'Prev')}</span>
            )}
            <span className="opacity-70">{L('صفحة', 'Page')} <b className="font-num">{page}</b> {L('من', 'of')} <b className="font-num">{totalPages}</b></span>
            {page < totalPages ? (
              <a href={pageHref(page + 1)} className="rounded border border-graphite/20 px-3 py-1 text-accent">{L('التالي', 'Next')} →</a>
            ) : (
              <span className="rounded border border-graphite/10 px-3 py-1 opacity-30">{L('التالي', 'Next')} →</span>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
