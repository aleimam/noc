import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { prisma } from '@noc/db';
import { PhotoGallery } from '@noc/ui';
import { localizeUnit, currency } from '@noc/i18n';

export const dynamic = 'force-dynamic';

export default async function BrokerageListingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: { values: { include: { option: true } }, typeOption: true, purposeOption: true, conditionOption: true },
  });
  // Brokerage only exposes our own inventory.
  if (!listing || listing.status !== 'PUBLISHED' || !listing.showOnBrokerage) notFound();

  const locale = (await getLocale()) as 'ar' | 'en';
  const t = await getTranslations('mp');
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  const photos = await prisma.attachment.findMany({
    where: { ownerType: 'Listing', ownerId: id, attributeId: null },
    orderBy: { createdAt: 'asc' },
    select: { path: true },
  });
  const attrIds = [...new Set(listing.values.map((v) => v.attributeId))];
  const attrs = attrIds.length
    ? await prisma.attribute.findMany({ where: { id: { in: attrIds } }, include: { section: true } })
    : [];
  const attrById = new Map(attrs.map((a) => [a.id, a]));

  // Aggregate values per attribute (MULTI_SELECT collapses into one row).
  const perAttr = new Map<string, { attr: (typeof attrs)[number]; texts: string[] }>();
  for (const v of listing.values) {
    const a = attrById.get(v.attributeId);
    if (!a) continue;
    if (!perAttr.has(a.id)) perAttr.set(a.id, { attr: a, texts: [] });
    const bucket = perAttr.get(a.id)!;
    if (v.option) bucket.texts.push(L(v.option.labelAr, v.option.labelEn));
    else if (v.number != null) { const u = localizeUnit(a.unit, locale); bucket.texts.push(`${String(v.number)}${u ? ` ${u}` : ''}`); }
    else if (v.bool) bucket.texts.push('✔');
    else if (v.text) bucket.texts.push(v.text);
  }
  // Group by section.
  const bySection = new Map<string, { section: (typeof attrs)[number]['section']; items: { label: string; value: string }[] }>();
  for (const { attr, texts } of perAttr.values()) {
    if (!texts.length) continue;
    const sId = attr.section.id;
    if (!bySection.has(sId)) bySection.set(sId, { section: attr.section, items: [] });
    bySection.get(sId)!.items.push({ label: L(attr.labelAr, attr.labelEn), value: texts.join(locale === 'ar' ? '، ' : ', ') });
  }
  const sections = [...bySection.values()].sort((a, b) => a.section.order - b.section.order);

  // Our inventory contacts the central ALSWARY number.
  const s = await prisma.setting.findMany({ where: { key: { in: ['alswarey_phone', 'alswarey_whatsapp'] } } });
  const m = Object.fromEntries(s.map((x) => [x.key, x.value]));
  const contactPhone = m.alswarey_phone || listing.contactPhone;
  const contactWhatsapp = m.alswarey_phone ? !!m.alswarey_whatsapp : listing.contactWhatsapp;
  const waNumber = contactPhone.replace(/\D/g, '');

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6 pb-24">
      <div className="flex items-center justify-between gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <a href="/" aria-label="ALSWARY"><img src="/logo.png" alt="الصواري" className="h-9 w-auto" /></a>
        <a href="/listings" className="text-sm text-accent">← {L('عروضنا العقارية', 'Our listings')}</a>
      </div>
      <PhotoGallery photos={photos.map((p) => p.path)} />

      <div>
        <div className="flex flex-wrap gap-1">
          {[listing.typeOption, listing.purposeOption, listing.conditionOption].map((o, i) => o && (
            <span key={i} className="rounded bg-graphite/10 px-2 py-0.5 text-xs">{L(o.nameAr, o.nameEn)}</span>
          ))}
        </div>
        <h1 className="mt-2 text-2xl font-bold text-primary">{listing.title}</h1>
        {listing.price != null && (
          <div className="mt-1 text-xl font-bold text-primary">
            {String(listing.price)} <span className="text-sm font-normal">{currency(locale)}</span>
            {listing.priceNote ? <span className="text-sm font-normal opacity-60"> · {listing.priceNote}</span> : null}
          </div>
        )}
      </div>

      {listing.description && <p className="whitespace-pre-wrap opacity-90">{listing.description}</p>}

      {sections.map((sec) => (
        <div key={sec.section.id} className="space-y-2">
          <h2 className="font-semibold text-primary">{L(sec.section.nameAr, sec.section.nameEn)}</h2>
          <div className="grid gap-x-6 sm:grid-cols-2">
            {sec.items.map((it, i) => (
              <div key={i} className="flex justify-between gap-3 border-b border-graphite/10 py-1.5 text-sm">
                <span className="opacity-70">{it.label}</span>
                <span className="text-end font-medium">{it.value}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="fixed inset-x-0 bottom-0 mx-auto flex max-w-3xl gap-3 border-t border-graphite/15 bg-bg p-3">
        {contactWhatsapp && (
          <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer" className="flex-1 rounded-md bg-green px-4 py-3 text-center font-semibold text-white">
            {t('whatsapp')}
          </a>
        )}
        <a href={`tel:${contactPhone}`} className="flex-1 rounded-md bg-primary px-4 py-3 text-center font-semibold text-soft">
          {t('callNow')}
        </a>
      </div>
    </main>
  );
}
