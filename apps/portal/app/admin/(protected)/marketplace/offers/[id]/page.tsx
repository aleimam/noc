import { notFound } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { PhotoGallery } from '@noc/ui';
import { OfferStatusButtons, DeleteOfferButton } from '../OfferActions';

export const dynamic = 'force-dynamic';

export default async function OfferDetail({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('listings', 'VIEW');
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

  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const fmt = (d: Date) => new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(d);
  // [label, value, forceLtr] — the LTR flag is explicit data. It used to be derived by
  // regex-matching the Arabic label, which would break silently once labels are translated.
  type Row = [string, string, boolean?];
  const m2 = L('م²', 'm²');
  const rows: Row[] = [
    [L('النوع', 'Type'), o.mode === 'SHEET' ? L('أرض في كشف التقنين', 'Land on a rationing sheet') : L('أرض مخصصة (تخصيص)', 'Allocated land')],
    [L('اسم المالك', 'Owner name'), o.ownerName],
    [L('الهاتف ١', 'Phone 1'), o.phone1, true],
    [L('الهاتف ٢', 'Phone 2'), o.phone2 ?? '—', true],
    [L('المساحة', 'Area'), o.area ? `${o.area} ${m2}` : '—', true],
    ...(o.mode === 'ALLOCATED'
      ? ([
          [L('المساحة الأصلية', 'Original area'), o.originalArea ? `${o.originalArea} ${m2}` : '—', true],
          [L('الحي', 'District'), o.district?.nameAr ?? '—'],
          [L('المجاورة', 'Neighborhood'), o.neighborhood?.nameAr ?? '—'],
          [L('البلوك', 'Block'), o.blockNo ?? '—'],
          [L('القطعة', 'Plot'), o.plotNo ?? '—'],
        ] as Row[])
      : ([[L('الجمعية', 'Association'), o.city?.name ?? '—']] as Row[])),
    [L('السعر المطلوب', 'Asking price'), o.requiredPrice != null ? `${Number(o.requiredPrice).toLocaleString('en')} ${L('ج.م', 'EGP')}` : '—', true],
    [L('مُرسِل', 'Submitted by'), o.user ? `${o.user.name ?? ''} ${o.user.phone ?? ''}`.trim() : L('زائر (بدون حساب)', 'Guest (no account)')],
    [L('التاريخ', 'Date'), fmt(o.createdAt)],
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{L('عرض بيع', 'Sale offer')} — {o.ownerName}</h1>
        <a href="/admin/marketplace/offers" className="text-sm text-accent">{L('← العروض', '← Offers')}</a>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <OfferStatusButtons id={o.id} current={o.status} />
        <DeleteOfferButton id={o.id} redirectTo="/admin/marketplace/offers" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-graphite/15 p-4">
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            {rows.map(([k, v, ltr]) => (
              <div key={k} className="contents">
                <dt className="opacity-60">{k}</dt>
                <dd className="font-medium" dir={ltr ? 'ltr' : undefined}>{v}</dd>
              </div>
            ))}
          </dl>
          {o.details && <p className="mt-3 border-t border-graphite/10 pt-3 text-sm whitespace-pre-line">{o.details}</p>}
        </div>

        <div className="rounded-lg border border-graphite/15 p-4">
          <h2 className="mb-2 font-semibold">{L('المستندات المرفقة (داخلي)', 'Attached documents (internal)')}</h2>
          {photos.length > 0 ? <PhotoGallery photos={photos.map((p) => p.path)} /> : <p className="text-sm opacity-60">{L('لا توجد مرفقات', 'No attachments')}</p>}
        </div>
      </div>
    </div>
  );
}
