import { notFound } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { PhotoGallery } from '@noc/ui';
import { OfferStatusButtons, DeleteOfferButton } from '../OfferActions';

export const dynamic = 'force-dynamic';

export default async function OfferDetail({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('marketplace', 'VIEW');
  const { id } = await params;
  const locale = (await getLocale()) as 'ar' | 'en';

  const o = await prisma.landOffer.findUnique({
    where: { id },
    include: {
      city: { select: { name: true } },
      district: { select: { nameAr: true } },
      neighborhood: { select: { nameAr: true } },
      user: { select: { phone: true, name: true } },
    },
  });
  if (!o) notFound();

  const photos = await prisma.attachment.findMany({
    where: { ownerType: 'LandOffer', ownerId: id },
    orderBy: { createdAt: 'asc' },
    select: { path: true },
  });

  const fmt = (d: Date) => new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(d);
  const rows: [string, string][] = [
    ['النوع', o.mode === 'SHEET' ? 'أرض في كشف التقنين' : 'أرض مخصصة (تخصيص)'],
    ['اسم المالك', o.ownerName],
    ['الهاتف ١', o.phone1],
    ['الهاتف ٢', o.phone2 ?? '—'],
    ['المساحة', o.area ? `${o.area} م²` : '—'],
    ...(o.mode === 'ALLOCATED'
      ? ([
          ['المساحة الأصلية', o.originalArea ? `${o.originalArea} م²` : '—'],
          ['الحي', o.district?.nameAr ?? '—'],
          ['المجاورة', o.neighborhood?.nameAr ?? '—'],
          ['البلوك', o.blockNo ?? '—'],
          ['القطعة', o.plotNo ?? '—'],
        ] as [string, string][])
      : ([['الجمعية', o.city?.name ?? '—']] as [string, string][])),
    ['السعر المطلوب', o.requiredPrice != null ? `${Number(o.requiredPrice).toLocaleString('en')} ج.م` : '—'],
    ['مُرسِل', o.user ? `${o.user.name ?? ''} ${o.user.phone ?? ''}`.trim() : 'زائر (بدون حساب)'],
    ['التاريخ', fmt(o.createdAt)],
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">عرض بيع — {o.ownerName}</h1>
        <a href="/admin/marketplace/offers" className="text-sm text-accent">← العروض</a>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <OfferStatusButtons id={o.id} current={o.status} />
        <DeleteOfferButton id={o.id} redirectTo="/admin/marketplace/offers" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-graphite/15 p-4">
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="opacity-60">{k}</dt>
                <dd className="font-medium" dir={/هاتف|السعر|المساحة/.test(k) ? 'ltr' : undefined}>{v}</dd>
              </div>
            ))}
          </dl>
          {o.details && <p className="mt-3 border-t border-graphite/10 pt-3 text-sm whitespace-pre-line">{o.details}</p>}
        </div>

        <div className="rounded-lg border border-graphite/15 p-4">
          <h2 className="mb-2 font-semibold">المستندات المرفقة (داخلي)</h2>
          {photos.length > 0 ? <PhotoGallery photos={photos.map((p) => p.path)} /> : <p className="text-sm opacity-60">لا توجد مرفقات</p>}
        </div>
      </div>
    </div>
  );
}
