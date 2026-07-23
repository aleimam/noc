import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { currency } from '@noc/i18n';
import { missingRequiredForListing } from '@noc/partner-portal/required';
import { resolveListingAssets } from '@noc/partner-portal/assets';
import { ModerationActions } from './ModerationActions';
import { RecentListingsTable, type RecentRow } from './RecentListingsTable';

// Force-dynamic: this admin table mutates via server actions and must never be served from a
// cached render — that (with the optimistic client controls) is why buttons no longer need a
// manual page reload to reflect their result.
export const dynamic = 'force-dynamic';

export default async function ModerationPage() {
  await requirePermission('listings', 'VIEW');
  const t = await getTranslations('mp');
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  const pending = await prisma.listing.findMany({
    where: { status: 'PENDING', deletedAt: null },
    orderBy: { createdAt: 'asc' },
    include: {
      typeOption: { select: { nameAr: true, nameEn: true } },
      owner: { select: { name: true, phone1: true } },
      seller: { select: { phone: true, name: true } },
    },
  });
  const recent = await prisma.listing.findMany({
    where: { status: { not: 'PENDING' }, deletedAt: null },
    orderBy: { updatedAt: 'desc' },
    take: 30,
    include: { typeOption: { select: { nameAr: true, nameEn: true } }, owner: { select: { name: true } } },
  });
  // Completeness per queued row. Required details are admin-configurable and can change AFTER a
  // listing enters the queue, so the queue itself must show what's missing — otherwise Approve
  // just fails and the admin has to guess which field it meant.
  const missingByListing = new Map(
    await Promise.all(
      pending.map(async (l) => [l.id, await missingRequiredForListing(l.id)] as const),
    ),
  );
  // Grab-and-go generated assets for the recent (non-PENDING) rows — the branded big poster + the
  // map, opened directly so staff needn't enter the editor to view/download them.
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

      <section className="space-y-2">
        <h2 className="font-semibold opacity-70">{t('statusPUBLISHED')} / {t('statusREJECTED')}</h2>
        <RecentListingsTable rows={recentRows} />
      </section>
    </div>
  );
}
