import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { currency } from '@noc/i18n';
import { ModerationActions } from './ModerationActions';
import { FeaturedToggle } from './FeaturedToggle';
import { ListingAdminActions } from './ListingAdminActions';

const STATUS_COLOR: Record<string, string> = {
  PUBLISHED: 'bg-green/15 text-green',
  PENDING: 'bg-gold/20 text-graphite',
  REJECTED: 'bg-red-100 text-red-700',
  SOLD: 'bg-navy/10 text-primary',
  DRAFT: 'bg-graphite/10 text-graphite',
  ARCHIVED: 'bg-graphite/10 text-graphite',
};

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
    include: { typeOption: { select: { nameAr: true, nameEn: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('moderation')}</h1>
        <div className="flex items-center gap-3">
          <a href="/admin/marketplace/listings/new" className="rounded-md bg-primary px-3 py-1.5 text-sm text-soft">+ {t('addLand')}</a>
          <a href="/admin/marketplace/listings/deleted" className="text-sm opacity-70 hover:opacity-100">🗑️ المحذوفات</a>
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
            </div>
            <div className="flex items-center gap-3">
              <a href={`/admin/marketplace/listings/${l.id}/edit`} className="text-sm text-accent">{t('edit')}</a>
              <ModerationActions id={l.id} />
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold opacity-70">{t('statusPUBLISHED')} / {t('statusREJECTED')}</h2>
        <div className="overflow-x-auto rounded-lg border border-graphite/15">
          <table className="w-full text-sm">
            <tbody>
              {recent.map((l) => (
                <tr key={l.id} className="border-t border-graphite/10 first:border-t-0">
                  <td className="p-2">{l.title}</td>
                  <td className="p-2 text-xs opacity-70">{L(l.typeOption?.nameAr ?? '', l.typeOption?.nameEn ?? '')}</td>
                  <td className="p-2">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs ${STATUS_COLOR[l.status] ?? ''}`}>{t(`status${l.status}`)}</span>
                  </td>
                  <td className="p-2">{l.showOnBrokerage && l.status === 'PUBLISHED' ? <FeaturedToggle id={l.id} initial={l.featured} /> : null}</td>
                  <td className="p-2 text-end">
                    <div className="flex items-center justify-end gap-3">
                      <a href={`/admin/marketplace/listings/${l.id}/edit`} className="text-accent">{t('edit')}</a>
                      <ListingAdminActions id={l.id} status={l.status} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
