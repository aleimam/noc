import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { prisma } from '@noc/db';
import { listingVisibleOnNewObour } from '@noc/partner-portal/visibility';
import { marketHref, resolveMarketListingId } from '../../../lib/listings';
import { cityHref, districtHref, neighborhoodHref } from '../../../lib/geoHref';
import { PhotoGallery, HeroGallery, TrackView, ListingCard, AreaAdvantages, AdminInfoStrip } from '@noc/ui';
import { localizeUnit, currency } from '@noc/i18n';
import { formatDetailValue, waPhone, isStoredPrice, type DetailConfig } from '@noc/config';
import { newObourVisibility } from '@noc/partner-portal/visibility';
import { auth } from '@noc/auth';
import { getStandardAreas } from '../../../lib/marketplace';
import { advantagesForNeighborhood } from '../../../lib/advantages';
import { getGeoInheritance, updatesForListing, customPhotosForListing, areaMapsForListing } from '../../../lib/geoInheritance';
import { amenitiesForListing } from '../../../lib/amenities';
import { listListingImages } from '../../../lib/poster/generate';
import { trackListingView } from '../../../lib/views';
import { partnershipsEnabled } from '../../../lib/modules';
import { SiteShell } from '../../_components/SiteShell';
import { AdminEditButton } from '../../_components/AdminEditButton';
import { pageMeta, breadcrumbLd, ldJson, abs } from '../../../lib/seo';
import { listingAlt } from '../../../lib/imageAlt';
import { coversForListings } from '../../../lib/listingCovers';
import { getAdminViewer, ownerDetailFor } from '../../../lib/adminView';
import { thumbUrl } from '../../../lib/thumb';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id: param } = await params;
  const locale = (await getLocale()) as 'ar' | 'en';
  const id = await resolveMarketListingId(param);
  const l = id
    ? await prisma.listing.findUnique({
        where: { id },
        select: { title: true, status: true, price: true, area: true, adNumber: true, description: true, typeOption: { select: { nameAr: true, nameEn: true } } },
      })
    : null;
  if (!id || !l || l.status !== 'PUBLISHED') return { title: locale === 'en' ? 'Listing — New Obour' : 'إعلان — العبور الجديدة' };
  const cover = await prisma.attachment.findFirst({
    where: { ownerType: 'Listing', ownerId: id, attributeId: null },
    orderBy: { createdAt: 'asc' },
    select: { path: true },
  });
  const parts = [
    l.typeOption ? (locale === 'ar' ? l.typeOption.nameAr : l.typeOption.nameEn) : '',
    l.area != null ? `${Number(l.area).toLocaleString('en-US')} ${locale === 'ar' ? 'م²' : 'm²'}` : '',
    // Same 0 ⇒ «السعر عند الطلب» rule as the page body. The meta/OG description is what Google
    // and WhatsApp shares display, so a bare non-null check advertised «0 ج.م» to the outside
    // world while the page itself correctly invited contact.
    isStoredPrice(l.price)
      ? `${Number(l.price).toLocaleString('en-US')} ${locale === 'ar' ? 'ج.م' : 'EGP'}`
      : locale === 'ar' ? 'السعر عند الطلب' : 'Price on request',
  ].filter(Boolean);
  const desc = ((l.description ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || parts.join(' · ')).slice(0, 160);
  return pageMeta({
    title: `${l.title} — ${locale === 'en' ? 'New Obour' : 'العبور الجديدة'}`,
    description: desc,
    path: marketHref({ id, adNumber: l.adNumber, typeEn: l.typeOption?.nameEn ?? null, area: l.area != null ? Number(l.area) : null }),
    images: cover ? [cover.path] : [],
    locale,
  });
}
import { getBuyerNegotiation } from '../../../lib/negotiation';
import { wishedSet } from '../../../lib/wishlist';
import { NegotiationThread } from '../../_components/NegotiationThread';
import { MarketCardActions } from '../../_components/MarketCardActions';
import { ListingContactBar } from '../../_components/ListingContactBar';

/** "YYYY-MM" → localized "Month Year". */
function formatMonthYear(s: string, locale: string): string {
  const [y, m] = s.split('-').map(Number);
  if (!y || !m) return s;
  try {
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en', { month: 'long', year: 'numeric' }).format(
      new Date(y, m - 1, 1),
    );
  } catch {
    return s;
  }
}

type Item = { label: string; value?: string; photos?: string[]; link?: 'url' | 'tel' };

/** Ensure a user-entered URL has a scheme so it links correctly. */
function safeUrl(v: string): string {
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

// Labels for inherited parent maps: which level a map came from + the fixed-kind fallback name.
const MAP_LEVEL_LABEL: Record<'city' | 'district' | 'neighborhood', { ar: string; en: string }> = {
  city: { ar: 'من المدينة', en: 'From the city' },
  district: { ar: 'من الحي', en: 'From the district' },
  neighborhood: { ar: 'من المجاورة', en: 'From the neighborhood' },
};
const MAP_KIND_LABEL: Record<string, { ar: string; en: string }> = {
  masterplan: { ar: 'المخطط العام', en: 'Masterplan' },
  location: { ar: 'خريطة الموقع', en: 'Location map' },
  services: { ar: 'خريطة مناطق الخدمات', en: 'Services-areas map' },
  mainroads: { ar: 'خريطة المحاور والطرق الرئيسية', en: 'Main roads (axis) map' },
};

export default async function ListingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id: param } = await params;
  const resolvedId = await resolveMarketListingId(param);
  const listing = resolvedId
    ? await prisma.listing.findUnique({
        where: { id: resolvedId },
        include: { values: { include: { option: true, listItem: true } }, typeOption: true, purposeOption: true, conditionOption: true, owner: { include: { portalUser: { select: { id: true } } } }, buildingConditions: { include: { condition: true } }, neighborhood: { include: { district: { include: { city: { select: { id: true, key: true, nameAr: true, nameEn: true } } } } } } },
      })
    : null;
  if (!listing || listing.status !== 'PUBLISHED' || listing.deletedAt) notFound();
  // Phase 4 — a partner listing whose partner isn't enabled for New Obour is hidden here (direct link → 404).
  if (!listingVisibleOnNewObour(listing)) notFound();
  const id = listing.id;
  // Canonicalize: permanently redirect legacy cuids / mismatched slugs to the SEO URL (308).
  const canonicalPath = marketHref({ id, adNumber: listing.adNumber, typeEn: listing.typeOption?.nameEn ?? null, area: listing.area != null ? Number(listing.area) : null });
  if (decodeURIComponent(param) !== canonicalPath.slice('/market/'.length)) permanentRedirect(canonicalPath);
  await trackListingView(id); // partner analytics: count the public view

  const locale = (await getLocale()) as 'ar' | 'en';
  const t = await getTranslations('mp');
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  // Descriptive alt text for every public photo of this listing (image SEO).
  const areaName = listing.neighborhood ? L(listing.neighborhood.nameAr, listing.neighborhood.nameEn) : null;
  const photoAlt = listingAlt(
    {
      type: listing.typeOption ? L(listing.typeOption.nameAr, listing.typeOption.nameEn) : null,
      area: listing.area != null ? Number(listing.area) : null,
      purpose: listing.purposeOption ? L(listing.purposeOption.nameAr, listing.purposeOption.nameEn) : null,
      city: listing.neighborhood?.district?.city ? L(listing.neighborhood.district.city.nameAr, listing.neighborhood.district.city.nameEn) : null,
      district: listing.neighborhood ? L(listing.neighborhood.district.nameAr, listing.neighborhood.district.nameEn) : null,
      neighborhood: areaName,
    },
    locale,
  ) || listing.title;

  // Peer negotiation: a logged-in customer (not the seller) can make/track price offers.
  const session = await auth();
  const viewerId = session?.user?.type === 'CUSTOMER' ? session.user.id : null;
  const isSeller = !!viewerId && viewerId === listing.sellerId;
  const negotiation = viewerId && !isSeller ? await getBuyerNegotiation(listing.id, viewerId) : null;
  const saved = (await wishedSet([listing.id])).has(listing.id);
  // Staff admin view only — never fetched (let alone rendered) for a visitor. ONE gate for the
  // whole internal card (owner + floor price + official papers + the edit link).
  const isAdminViewer = !!(await getAdminViewer());
  const adminDetail = isAdminViewer ? await ownerDetailFor(listing.id) : null;

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

  const partnershipsOn = await partnershipsEnabled();

  // Official papers (internal): merged INTO the single admin card below, so they share its gate
  // (live STAFF row + `owners:VIEW`) instead of the weaker session-type check they used before.
  const paperRows = isAdminViewer
    ? await prisma.attachment.findMany({ where: { ownerType: 'ListingPaper', ownerId: id }, select: { path: true, stampCategory: true } })
    : [];
  const paperPhoto = (cat: string) => paperRows.find((p) => p.stampCategory === cat)?.path ?? null;

  // Gallery images (SEO/JSON-LD + recently-viewed cover). When the listing has no uploaded
  // photos (e.g. land plots), fall back to its annotated location map.
  const listingLocMap = await prisma.areaMap.findFirst({ where: { level: 'listing', areaId: id, kind: 'location' }, select: { newobourPath: true, cleanPath: true } });
  const locMapPath = listingLocMap?.newobourPath || listingLocMap?.cleanPath || null;
  let galleryPaths = photos.map((p) => p.path);
  if (galleryPaths.length === 0 && locMapPath) galleryPaths = [locMapPath];

  const attrIds = [...new Set(listing.values.map((v) => v.attributeId))];
  const attrs = attrIds.length
    ? await prisma.attribute.findMany({ where: { id: { in: attrIds } }, include: { section: true } })
    : [];
  const attrById = new Map(attrs.map((a) => [a.id, a]));
  const standardAreas = await getStandardAreas();
  // Area content flows onto the listing per the admin inheritance matrix ('geo.inheritance').
  const geoMatrix = await getGeoInheritance();
  const advGroups = await advantagesForNeighborhood(listing.neighborhoodId, locale, geoMatrix);
  const [areaUpdates, areaAmenities, areaPhotos, areaMaps] = await Promise.all([
    updatesForListing(listing.neighborhoodId, geoMatrix),
    amenitiesForListing(listing.id, listing.neighborhoodId, geoMatrix),
    customPhotosForListing(listing.neighborhoodId, geoMatrix),
    areaMapsForListing(listing.neighborhoodId, 'newobour', geoMatrix),
  ]);
  const showAreaLinks = geoMatrix.maps.toListing && !!listing.neighborhood;
  const fmtDate = (d: Date) => new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const genImgs = await listListingImages(listing.id, 'newobour');

  // ── Hero gallery (ecommerce-style, one strip at the top): photos → posters → maps ──
  // Everything image-like about the listing lives here; the old scattered sections are gone.
  const POSTER_LABEL: Record<string, { ar: string; en: string }> = {
    poster: { ar: 'صورة العرض', en: 'Listing poster' },
    card: { ar: 'بطاقة الإعلان', en: 'Listing card' },
    adv: { ar: 'مميزات المنطقة', en: 'Area advantages' },
  };
  const heroItems: { src: string; label?: string }[] = [];
  const heroSeen = new Set<string>();
  const pushHero = (src: string | null | undefined, label?: string) => {
    if (!src || heroSeen.has(src)) return;
    heroSeen.add(src);
    heroItems.push(label ? { src, label } : { src });
  };
  // Order (owner, 2026-07-16): ① the plot's annotated location map ② the big poster
  // ③ real photos ④ remaining generated cards ⑤ area photos + other inherited maps.
  pushHero(locMapPath, L('موقع القطعة', 'Plot location'));
  const bigPoster = genImgs.find((g) => g.kind === 'poster');
  pushHero(bigPoster?.path, L('صورة العرض', 'Listing poster'));
  for (const p of photos) pushHero(p.path);
  for (const g of genImgs) pushHero(g.path, L(POSTER_LABEL[g.kind]?.ar ?? 'صورة العرض', POSTER_LABEL[g.kind]?.en ?? 'Listing poster'));
  for (const p of areaPhotos) pushHero(p.path, p.title || L('صور المنطقة', 'Area photo'));
  for (const mp of areaMaps) {
    // The listing's location map IS the annotated neighborhood masterplan — don't show the
    // clean masterplan again beside it (owner request).
    if (locMapPath && mp.level === 'neighborhood' && mp.kind === 'masterplan') continue;
    pushHero(mp.path, `${L(MAP_LEVEL_LABEL[mp.level].ar, MAP_LEVEL_LABEL[mp.level].en)} — ${mp.title || L(MAP_KIND_LABEL[mp.kind]?.ar ?? mp.kind, MAP_KIND_LABEL[mp.kind]?.en ?? mp.kind)}`);
  }

  // Recommendations: other published listings of the same type ("like what you're viewing").
  const similar = listing.typeOptionId
    ? await prisma.listing.findMany({
        where: { status: 'PUBLISHED', ...newObourVisibility(), typeOptionId: listing.typeOptionId, id: { not: listing.id } },
        orderBy: { publishedAt: 'desc' },
        take: 6,
        select: { id: true, title: true, price: true, adNumber: true, area: true, typeOption: { select: { nameAr: true, nameEn: true } } },
      })
    : [];
  // Cover chain (location map → photo) — plot listings have maps, not photos.
  const simCovers = await coversForListings(similar.map((s) => s.id));

  // Resolve DISTRICT / NEIGHBORHOOD values (stored as geo ids) to localized names.
  const geoIds = listing.values
    .filter((v) => ['DISTRICT', 'NEIGHBORHOOD'].includes(attrById.get(v.attributeId)?.type ?? '') && v.text)
    .map((v) => v.text as string);
  const geoName = new Map<string, { ar: string; en: string }>();
  if (geoIds.length) {
    const [ds, ns] = await Promise.all([
      prisma.district.findMany({ where: { id: { in: geoIds } }, select: { id: true, nameAr: true, nameEn: true } }),
      prisma.neighborhood.findMany({ where: { id: { in: geoIds } }, select: { id: true, nameAr: true, nameEn: true } }),
    ]);
    for (const g of [...ds, ...ns]) geoName.set(g.id, { ar: g.nameAr, en: g.nameEn });
  }

  // Aggregate scalar values per attribute. DOCUMENTS are internal (never shown); PHOTOS render as a grid below.
  const perAttr = new Map<string, { attr: (typeof attrs)[number]; texts: string[] }>();
  for (const v of listing.values) {
    const a = attrById.get(v.attributeId);
    if (!a || a.type === 'DOCUMENTS' || a.type === 'PHOTOS') continue;
    if (!perAttr.has(a.id)) perAttr.set(a.id, { attr: a, texts: [] });
    const bucket = perAttr.get(a.id)!;
    if (v.listItem) {
      bucket.texts.push(L(v.listItem.labelAr, v.listItem.labelEn));
    } else if (v.option) {
      bucket.texts.push(L(v.option.labelAr, v.option.labelEn));
    } else if ((a.type === 'DISTRICT' || a.type === 'NEIGHBORHOOD') && v.text) {
      const g = geoName.get(v.text);
      if (g) bucket.texts.push(L(g.ar, g.en));
    } else if (a.type === 'DATE' && v.text) {
      bucket.texts.push(formatMonthYear(v.text, locale));
    } else if (a.type === 'NUMBER' && v.number != null) {
      const u = localizeUnit(a.unit, locale);
      bucket.texts.push(`${String(v.number)}${u ? ` ${u}` : ''}`);
    } else {
      const s = formatDetailValue({
        type: a.type,
        unit: a.unit,
        number: v.number != null ? Number(v.number) : null,
        bool: v.bool,
        text: v.text,
        config: a.config as DetailConfig | null,
        locale,
        standardAreas,
      });
      if (s) bucket.texts.push(s);
    }
  }

  // Group items by section (text items + per-property photo grids).
  const bySection = new Map<string, { section: (typeof attrs)[number]['section']; items: Item[] }>();
  const pushItem = (section: (typeof attrs)[number]['section'], item: Item) => {
    if (!bySection.has(section.id)) bySection.set(section.id, { section, items: [] });
    bySection.get(section.id)!.items.push(item);
  };
  for (const { attr, texts } of perAttr.values()) {
    if (!texts.length) continue;
    const link = attr.type === 'URL' ? 'url' : attr.type === 'PHONE' ? 'tel' : undefined;
    pushItem(attr.section, { label: L(attr.labelAr, attr.labelEn), value: texts.join(locale === 'ar' ? '، ' : ', '), link });
  }
  for (const a of attrs) {
    if (a.type !== 'PHOTOS') continue;
    const ph = photosByAttr.get(a.id);
    if (ph?.length) pushItem(a.section, { label: L(a.labelAr, a.labelEn), photos: ph });
  }
  const sections = [...bySection.values()].sort((a, b) => a.section.order - b.section.order);

  // Contact rule: an individual owner is reached directly; anything owned by us, a company
  // or a broker routes to our central Al Sawarey number (we broker those).
  const effOwnerType = listing.owner?.type ?? listing.ownerType ?? 'PERSONAL';
  const weAreContact = effOwnerType !== 'PERSONAL';
  let contactPhone = listing.contactPhone;
  let contactWhatsapp = listing.contactWhatsapp;
  const ownerName = listing.owner?.name ?? listing.ownerName ?? '';
  if (weAreContact) {
    const s = await prisma.setting.findMany({ where: { key: { in: ['alswarey_phone', 'alswarey_whatsapp'] } } });
    const m = Object.fromEntries(s.map((x) => [x.key, x.value]));
    if (m.alswarey_phone) {
      contactPhone = m.alswarey_phone;
      contactWhatsapp = !!m.alswarey_whatsapp;
    }
  } else if (listing.owner?.phone1) {
    contactPhone = listing.owner.phone1;
    contactWhatsapp = listing.owner.phone1Whatsapp;
  }
  const waNumber = waPhone(contactPhone); // wa.me needs international form (01x → 201x)

  // First-party photo analytics (admin-switchable in Settings → إعدادات الموقع; default ON).
  const analyticsFlag = await prisma.setting.findFirst({ where: { key: 'gallery.photoAnalytics' } });
  const heroTrackKey = analyticsFlag?.value !== '0' ? listing.id : undefined;

  const perLabel =
    listing.priceUnit === 'UNIT' ? (locale === 'ar' ? 'للوحدة' : 'per unit') : listing.priceUnit === 'SQM' ? (locale === 'ar' ? 'للمتر' : 'per m²') : '';

  // Structured data: a land listing (Product/RealEstateListing + Offer) and its breadcrumb trail.
  // canonicalPath (the SEO URL) is computed at the top of the component.
  const plainDesc = (listing.description ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const listingLd = {
    '@context': 'https://schema.org',
    '@type': ['Product', 'RealEstateListing'],
    name: listing.title,
    // ImageObject entries (contentUrl + caption = the photo's alt); the first is flagged
    // representativeOfPage. schema.org accepts ImageObject in the `image` field.
    image: galleryPaths.map((p, i) => ({
      '@type': 'ImageObject',
      contentUrl: abs(p),
      url: abs(p),
      caption: galleryPaths.length > 1 ? `${photoAlt} — ${L('صورة', 'photo')} ${i + 1}` : photoAlt,
      ...(i === 0 ? { representativeOfPage: true } : {}),
    })),
    ...(plainDesc ? { description: plainDesc.slice(0, 500) } : {}),
    category: 'Real Estate Land',
    url: abs(canonicalPath),
    ...(listing.publishedAt ? { datePosted: listing.publishedAt.toISOString() } : {}),
    ...(listing.price != null && Number(listing.price) > 0
      ? { offers: { '@type': 'Offer', priceCurrency: 'EGP', price: Number(listing.price), availability: 'https://schema.org/InStock', url: abs(canonicalPath) } }
      : {}),
  };
  const crumbsLd = breadcrumbLd([
    { name: L('الرئيسية', 'Home'), path: '/' },
    { name: t('title'), path: '/market' },
    { name: listing.title, path: canonicalPath },
  ]);

  return (
    <SiteShell active="market">
      <main className="mx-auto max-w-3xl space-y-6 p-6 pb-24">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson([listingLd, crumbsLd]) }} />
      <TrackView item={{ id: listing.id, title: listing.title, cover: galleryPaths[0] ? thumbUrl(galleryPaths[0], 320) : null, price: isStoredPrice(listing.price) ? String(listing.price) : null, href: canonicalPath }} />
      <div className="flex justify-end"><MarketCardActions listingId={listing.id} initialSaved={saved} compareLabel={t('compare')} /></div>
      <a href="/market" className="text-sm text-accent">‹ {t('title')}</a>
      <HeroGallery items={heroItems} alt={photoAlt} locale={locale} trackKey={heroTrackKey} />

      <div>
        <div className="flex flex-wrap gap-1">
          {[listing.typeOption, listing.purposeOption, listing.conditionOption].map((o, i) => o && (
            <span key={i} className="rounded bg-graphite/10 px-2 py-0.5 text-xs">{L(o.nameAr, o.nameEn)}</span>
          ))}
        </div>
        <h1 className="mt-2 text-2xl font-bold text-primary">{listing.title}</h1>
        {/* Staff admin view — THE single internal card (owner contact + floor price + official
            papers + the edit link). Owner rule 2026-07-22: everything admin-only lives here and
            NOWHERE else on the page. Gated on the LIVE staff row + `owners:VIEW`, so a visitor
            can never receive any of it. */}
        {adminDetail && (
          <section className="mt-2 rounded-lg border border-amber-400 bg-amber-50 px-2.5 py-1.5 text-navy-800">
            {/* COMPACT (owner request 2026-07-22): one wrapping row of chips instead of a dl +
                a papers grid. Papers are chips; a paper that has a scan links to it (📎). */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs leading-tight">
              <span className="font-bold text-amber-800">🔒 {L('داخلي', 'Internal')}</span>
              <span><span className="opacity-60">{L('المالك', 'Owner')}:</span> <b>{adminDetail.ownerName ?? '—'}</b></span>
              {adminDetail.phone1 && (
                <span className="font-num" dir="ltr">{adminDetail.phone1}</span>
              )}
              {adminDetail.phone2 && <span className="font-num" dir="ltr">{adminDetail.phone2}</span>}
              <span><span className="opacity-60">{L('أضافه', 'By')}:</span> <b>{adminDetail.createdByName ?? '—'}</b></span>
              <span className="rounded bg-amber-200/70 px-1.5 py-0.5 font-bold text-amber-900">
                {L('أقل سعر', 'Floor')}:{' '}
                {adminDetail.lowestPrice != null ? (
                  <><span className="font-num" dir="ltr">{adminDetail.lowestPrice.toLocaleString('en-US')}</span> {currency(locale)}</>
                ) : (
                  <span className="font-normal opacity-70">{L('غير محدد', 'not set')}</span>
                )}
              </span>
              {[
                { label: L('تحصيص', 'Allocation'), has: listing.hasAllocationLetter, photo: paperPhoto('allocation_letter') },
                { label: L('توكيل', 'Mandate'), has: listing.hasSaleMandate, photo: paperPhoto('sale_mandate') },
              ].map((p, i) => {
                const chip = (
                  <span className={`rounded-full px-1.5 py-0.5 font-bold ${p.has ? 'bg-green/15 text-green' : 'bg-graphite/10 text-graphite/50'}`}>
                    🗂️ {p.label} {p.has ? '✓' : '✗'}{p.has && p.photo ? ' 📎' : ''}
                  </span>
                );
                return p.has && p.photo ? (
                  <a key={i} href={p.photo} target="_blank" rel="noreferrer" title={p.label}>{chip}</a>
                ) : (
                  <span key={i}>{chip}</span>
                );
              })}
              <span className="ms-auto"><AdminEditButton href={`/admin/marketplace/listings/${listing.id}/edit`} section="listings" compact /></span>
            </div>
            {adminDetail.details && <p className="mt-1 text-[11px] leading-snug opacity-80">{adminDetail.details}</p>}
          </section>
        )}
        {listing.area != null && (
          <div className="mt-1 text-lg font-semibold text-primary">
            {locale === 'ar' ? 'المساحة الفعلية' : 'Actual area'}: {Number(listing.area).toLocaleString('en-US')} <span className="text-sm font-normal">{locale === 'ar' ? 'م²' : 'm²'}</span>
          </div>
        )}
        {listing.price != null && Number(listing.price) > 0 ? (
          <div className="mt-1 text-xl font-bold text-primary">
            {Number(listing.price).toLocaleString('en-US')} <span className="text-sm font-normal">{currency(locale)}{perLabel ? ` / ${perLabel}` : ''}</span>
            {listing.priceNegotiable && (
              <span className="ms-2 rounded bg-gold/20 px-2 py-0.5 text-xs font-normal text-primary">{locale === 'ar' ? 'قابل للتفاوض' : 'Negotiable'}</span>
            )}
            {listing.priceNote ? <span className="text-sm font-normal opacity-60"> · {listing.priceNote}</span> : null}
          </div>
        ) : (
          // 0/blank price ⇒ invite contact instead of showing «0» (owner request 2026-07-18)
          <div className="mt-1 text-lg font-bold text-gold-700">{locale === 'ar' ? 'السعر عند الطلب — تواصل لمعرفة السعر' : 'Price on request — contact to know the price'}</div>
        )}
      </div>

      <div className="rounded-lg border border-graphite/15 px-4 py-2 text-sm">
        <span className="opacity-70">{t('owner')}: </span>
        <span className="font-medium">{weAreContact ? t('listedByUs') : ownerName || '—'}</span>
      </div>

      {/* (Official papers moved INTO the single admin card above — owner rule 2026-07-22.) */}

      {/* Plot consolidation & partnerships: the owner opted this plot in. */}
      {listing.isPartnership && partnershipsOn && (
        <div className="rounded-lg border border-gold-300/50 bg-gold/10 p-4">
          <div className="font-bold text-primary">🤝 {t('partnershipTitle')}</div>
          <p className="mt-1 text-sm opacity-80">
            {listing.partnershipType ? t(`pt_${listing.partnershipType}`) : t('partnershipBadge')}
            {listing.partnershipNote ? ` — ${listing.partnershipNote}` : ''}
          </p>
          <p className="mt-1 text-xs opacity-60">{t('partnershipContactHint')}</p>
        </div>
      )}

      {listing.neighborhood && (
        <div className="text-sm">
          <span className="opacity-70">{L('المنطقة', 'Location')}: </span>
          <a href={districtHref(listing.neighborhood.district)} className="text-accent hover:underline">{L(listing.neighborhood.district.nameAr, listing.neighborhood.district.nameEn)}</a>
          <span className="opacity-50"> — </span>
          <a href={neighborhoodHref(listing.neighborhood)} className="text-accent hover:underline">{L(listing.neighborhood.nameAr, listing.neighborhood.nameEn)}</a>
        </div>
      )}

      {listing.description &&
        (/<\w/.test(listing.description) ? (
          <div className="page-content opacity-90" dangerouslySetInnerHTML={{ __html: listing.description }} />
        ) : (
          <p className="whitespace-pre-wrap opacity-90">{listing.description}</p>
        ))}

      {sections.map((s) => (
        <div key={s.section.id} className="space-y-2">
          <h2 className="font-semibold text-primary">{L(s.section.nameAr, s.section.nameEn)}</h2>
          <div className="grid gap-x-6 sm:grid-cols-2">
            {s.items.map((it, i) =>
              it.photos ? (
                <div key={i} className="space-y-1 py-1.5 sm:col-span-2">
                  <div className="text-sm opacity-70">{it.label}</div>
                  <PhotoGallery photos={it.photos} alt={`${photoAlt} — ${it.label}`} locale={locale} />
                </div>
              ) : (
                <div key={i} className="flex justify-between gap-3 border-b border-graphite/10 py-1.5 text-sm">
                  <span className="opacity-70">{it.label}</span>
                  <span className="text-end font-medium">
                    {it.link === 'url' && it.value ? (
                      <a href={safeUrl(it.value)} target="_blank" rel="noopener noreferrer" dir="ltr" className="text-accent underline">{it.value}</a>
                    ) : it.link === 'tel' && it.value ? (
                      <a href={`tel:${it.value.replace(/\s/g, '')}`} dir="ltr" className="text-accent underline">{it.value}</a>
                    ) : (
                      it.value
                    )}
                  </span>
                </div>
              ),
            )}
          </div>
        </div>
      ))}

      {/* (Advantages moved to the BOTTOM of the page — owner request 2026-07-22.) */}

      {/* About the area — inherited area content (matrix-gated), closed by default so it
          never buries the listing itself. */}
      {listing.neighborhood && (areaUpdates.length > 0 || areaAmenities.length > 0 || showAreaLinks) && (
        <details className="rounded-lg border border-graphite/15 p-4">
          <summary className="cursor-pointer text-lg font-semibold text-primary">{L('عن المنطقة', 'About the area')}</summary>
          <div className="mt-3 space-y-5">
            {areaUpdates.length > 0 && (
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-primary">{L('آخر تحديثات المنطقة', 'Latest area updates')}</h3>
                <ul>
                  {areaUpdates.map((u) => (
                    <li key={u.id} className="flex items-baseline justify-between gap-3 border-b border-graphite/10 py-2 text-sm">
                      <span className="font-medium">{u.title || L('تحديث', 'Update')}</span>
                      <span className="shrink-0 text-xs opacity-60" dir="ltr">{fmtDate(u.happenedAt)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {areaAmenities.length > 0 && (
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-primary">{L('مرافق المنطقة', 'Area amenities')}</h3>
                <ul className="flex flex-wrap gap-2">
                  {areaAmenities.map((a) => (
                    <li key={a.id} className="rounded-full bg-graphite/10 px-3 py-1.5 text-sm">
                      {a.category ? `${L(a.category.ar, a.category.en)} · ` : ''}
                      {L(a.titleAr, a.titleEn || a.titleAr)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {/* Area maps & custom area photos moved into the hero gallery at the top (2026-07-16). */}
            {showAreaLinks && listing.neighborhood && (
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-primary">{L('صفحات المنطقة', 'Area pages')}</h3>
                <div className="flex flex-wrap gap-2">
                  <a href={neighborhoodHref(listing.neighborhood)} className="rounded-lg border border-accent/40 px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/5">
                    {L(listing.neighborhood.nameAr, listing.neighborhood.nameEn)}
                  </a>
                  <a href={districtHref(listing.neighborhood.district)} className="rounded-lg border border-accent/40 px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/5">
                    {L(listing.neighborhood.district.nameAr, listing.neighborhood.district.nameEn)}
                  </a>
                  {listing.neighborhood.district.city && (
                    <a href={cityHref(listing.neighborhood.district.city)} className="rounded-lg border border-accent/40 px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/5">
                      {L(listing.neighborhood.district.city.nameAr, listing.neighborhood.district.city.nameEn)}
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </details>
      )}

      {listing.buildingConditions.length > 0 && (
        <details className="rounded-lg border border-graphite/15 p-4">
          <summary className="cursor-pointer font-semibold text-primary">{locale === 'en' ? 'Building conditions' : 'اشتراطات البناء'}</summary>
          <div className="mt-3 space-y-6">
            {listing.buildingConditions.map((b) => (
              <div key={b.conditionId}>
                <h3 className="mb-2 font-bold text-primary">{L(b.condition.titleAr, b.condition.titleEn)}</h3>
                <div className="page-content leading-relaxed text-ink-800" dangerouslySetInnerHTML={{ __html: L(b.condition.bodyAr, b.condition.bodyEn || b.condition.bodyAr) }} />
                <a href={`/guide/conditions/${b.condition.slug}`} className="mt-1 inline-block text-sm text-accent">{locale === 'en' ? 'Open full page ↗' : 'فتح الصفحة كاملة ↗'}</a>
              </div>
            ))}
          </div>
        </details>
      )}

      {similar.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-navy-800 dark:text-soft">{t('similarListings')}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {similar.map((s) => (
              <ListingCard key={s.id} href={marketHref({ id: s.id, adNumber: s.adNumber, typeEn: s.typeOption?.nameEn ?? null, area: s.area != null ? Number(s.area) : null })} cover={simCovers.get(s.id) ?? null} title={s.title} subtitle={L(s.typeOption?.nameAr ?? '', s.typeOption?.nameEn ?? '')} price={s.price != null && Number(s.price) > 0 ? Number(s.price).toLocaleString('en-US') : null} priceOnRequest={L('السعر عند الطلب', 'Price on request')} currency={currency(locale)} alt={listingAlt({ type: L(s.typeOption?.nameAr ?? '', s.typeOption?.nameEn ?? ''), area: s.area != null ? Number(s.area) : null }, locale) || s.title} />
            ))}
          </div>
        </section>
      )}

      {/* Peer price negotiation (New Obour market) */}
      {viewerId && !isSeller && (
        <section className="mb-24">
          <NegotiationThread role="buyer" listingId={listing.id} negotiation={negotiation} locale={locale} />
        </section>
      )}
      {isSeller && (
        <div className="mb-24 rounded-2xl border border-ink-200 bg-white p-4 text-center text-sm">
          <a href="/account/offers" className="font-bold text-accent">{t('negoIncoming')}</a>
        </div>
      )}
      {!viewerId && (
        <div className="mb-24 rounded-2xl border border-ink-200 bg-white p-4 text-center text-sm">
          <a href={`/account/login?next=${canonicalPath}`} className="font-bold text-accent">{t('negoLoginToOffer')}</a>
        </div>
      )}

      {/* Area advantages — LAST content block on the page (owner request 2026-07-22), so the
          listing's own details and CTAs come first. mb-24 clears the sticky contact bar. */}
      {advGroups.length > 0 && (
        <div className="mb-24">
          <AreaAdvantages heading={L('مميزات المنطقة', 'Area advantages')} groups={advGroups} />
        </div>
      )}

      <ListingContactBar
        listingId={listing.id}
        waNumber={waNumber}
        contactPhone={contactPhone}
        contactWhatsapp={contactWhatsapp}
        whatsappLabel={t('whatsapp')}
        callLabel={t('callNow')}
      />
      </main>
    </SiteShell>
  );
}
