import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { prisma } from '@noc/db';
import { PhotoGallery } from '@noc/ui';
import { localizeUnit, currency } from '@noc/i18n';

/** "YYYY-MM" → localized "Month Year". */
function formatMonthYear(s: string, locale: string): string {
  const [y, m] = s.split('-').map(Number);
  if (!y || !m) return s;
  try {
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en', { month: 'long', year: 'numeric' }).format(
      new Date(y, m - 1, 1),
    );
  } catch {
    return s;
  }
}

type Item = { label: string; value?: string; photos?: string[] };

export default async function ListingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: { values: { include: { option: true } }, propertyType: true },
  });
  if (!listing || listing.status !== 'PUBLISHED') notFound();

  const locale = (await getLocale()) as 'ar' | 'en';
  const t = await getTranslations('mp');
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  // Main gallery = attachments with no attribute. Per-property files carry an attributeId.
  const [photos, propRows] = await Promise.all([
    prisma.attachment.findMany({
      where: { ownerType: 'Listing', ownerId: id, attributeId: null },
      orderBy: { createdAt: 'asc' },
      select: { path: true },
    }),
    prisma.attachment.findMany({
      where: { ownerType: 'Listing', ownerId: id, attributeId: { not: null } },
      orderBy: { createdAt: 'asc' },
      select: { path: true, attributeId: true },
    }),
  ]);
  const photosByAttr = new Map<string, string[]>();
  for (const r of propRows) {
    if (!r.attributeId) continue;
    const arr = photosByAttr.get(r.attributeId) ?? [];
    arr.push(r.path);
    photosByAttr.set(r.attributeId, arr);
  }

  const attrIds = [...new Set(listing.values.map((v) => v.attributeId))];
  const attrs = attrIds.length
    ? await prisma.attribute.findMany({ where: { id: { in: attrIds } }, include: { section: true } })
    : [];
  const attrById = new Map(attrs.map((a) => [a.id, a]));

  // Aggregate scalar values per attribute. DOCUMENTS are internal (never shown); PHOTOS render as a grid below.
  const perAttr = new Map<string, { attr: (typeof attrs)[number]; texts: string[] }>();
  for (const v of listing.values) {
    const a = attrById.get(v.attributeId);
    if (!a || a.type === 'DOCUMENTS' || a.type === 'PHOTOS') continue;
    if (!perAttr.has(a.id)) perAttr.set(a.id, { attr: a, texts: [] });
    const bucket = perAttr.get(a.id)!;
    if (v.option) bucket.texts.push(L(v.option.labelAr, v.option.labelEn));
    else if (v.number != null) {
      const u = localizeUnit(a.unit, locale);
      bucket.texts.push(`${String(v.number)}${u ? ` ${u}` : ''}`);
    } else if (v.bool) bucket.texts.push('✔');
    else if (a.type === 'DATE' && v.text) bucket.texts.push(formatMonthYear(v.text, locale));
    else if (v.text) bucket.texts.push(v.text);
  }

  // Group items by section (text items + per-property photo grids).
  const bySection = new Map<string, { section: (typeof attrs)[number]['section']; items: Item[] }>();
  const pushItem = (section: (typeof attrs)[number]['section'], item: Item) => {
    if (!bySection.has(section.id)) bySection.set(section.id, { section, items: [] });
    bySection.get(section.id)!.items.push(item);
  };
  for (const { attr, texts } of perAttr.values()) {
    if (!texts.length) continue;
    pushItem(attr.section, { label: L(attr.labelAr, attr.labelEn), value: texts.join(locale === 'ar' ? '، ' : ', ') });
  }
  for (const a of attrs) {
    if (a.type !== 'PHOTOS') continue;
    const ph = photosByAttr.get(a.id);
    if (ph?.length) pushItem(a.section, { label: L(a.labelAr, a.labelEn), photos: ph });
  }
  const sections = [...bySection.values()].sort((a, b) => a.section.order - b.section.order);

  // Our listings (staff-created) use the central ALSWARY contact; sellers use their own number.
  let contactPhone = listing.contactPhone;
  let contactWhatsapp = listing.contactWhatsapp;
  if (listing.createdById) {
    const s = await prisma.setting.findMany({ where: { key: { in: ['alswarey_phone', 'alswarey_whatsapp'] } } });
    const m = Object.fromEntries(s.map((x) => [x.key, x.value]));
    if (m.alswarey_phone) {
      contactPhone = m.alswarey_phone;
      contactWhatsapp = !!m.alswarey_whatsapp;
    }
  }
  const waNumber = contactPhone.replace(/\D/g, '');

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6 pb-24">
      <a href="/market" className="text-sm text-accent">← {t('title')}</a>
      <PhotoGallery photos={photos.map((p) => p.path)} />

      <div>
        <span className="rounded bg-graphite/10 px-2 py-0.5 text-xs">{L(listing.propertyType.nameAr, listing.propertyType.nameEn)}</span>
        <h1 className="mt-2 text-2xl font-bold text-primary">{listing.title}</h1>
        {listing.price != null && (
          <div className="mt-1 text-xl font-bold text-primary">
            {String(listing.price)} <span className="text-sm font-normal">{currency(locale)}</span>
            {listing.priceNote ? <span className="text-sm font-normal opacity-60"> · {listing.priceNote}</span> : null}
          </div>
        )}
      </div>

      {listing.description && <p className="whitespace-pre-wrap opacity-90">{listing.description}</p>}

      {sections.map((s) => (
        <div key={s.section.id} className="space-y-2">
          <h2 className="font-semibold text-primary">{L(s.section.nameAr, s.section.nameEn)}</h2>
          <div className="grid gap-x-6 sm:grid-cols-2">
            {s.items.map((it, i) =>
              it.photos ? (
                <div key={i} className="space-y-1 py-1.5 sm:col-span-2">
                  <div className="text-sm opacity-70">{it.label}</div>
                  <PhotoGallery photos={it.photos} />
                </div>
              ) : (
                <div key={i} className="flex justify-between gap-3 border-b border-graphite/10 py-1.5 text-sm">
                  <span className="opacity-70">{it.label}</span>
                  <span className="text-end font-medium">{it.value}</span>
                </div>
              ),
            )}
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
