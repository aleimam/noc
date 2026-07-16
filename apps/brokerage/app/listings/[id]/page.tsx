import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { prisma } from '@noc/db';
import { PhotoGallery, HeroGallery, TrackView, AreaAdvantages } from '@noc/ui';
import { StoreShell } from '../../_components/StoreShell';
import { advantagesForNeighborhood } from '../../../lib/advantages';
import { updatesForListing, customPhotosForListing, areaMapsForListing } from '../../../lib/geoInheritance';
import { StoreLandCard } from '../../_components/StoreLandCard';
import { getLandDetail, resolveListingId, similarLands } from '../../../lib/listings';
import { getAdminViewer, ownerDetailFor } from '../../../lib/adminView';
import { wishlistListingIds } from '../../../lib/wishlist';
import { trackListingView } from '../../../lib/views';
import { getStorefront } from '../../../lib/storefront';
import { pageMeta, breadcrumbLd, ldJson } from '../../../lib/seo';
import { listingAlt, geoPhotoAlt } from '../../../lib/imageAlt';
import { BuyButton } from './BuyButton';
import { ShareButtons } from './ShareButtons';
import { WishlistButton } from '../../_components/WishlistButton';

export const dynamic = 'force-dynamic';
const fmt = (n: number) => n.toLocaleString('en');
const BASE = (process.env.BROKERAGE_URL || 'https://alsawarey.com').replace(/\/$/, '');

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

import { waPhone } from '@noc/config';
import { thumbUrl } from '../../../lib/thumb';

/** Owner phone in the staff card: the number on desktop, plus tap-to-call and (when the
 *  line has WhatsApp) tap-to-WhatsApp icons. On mobile only the icons show. */
function OwnerPhone({ num, wa }: { num: string | null; wa: boolean }) {
  if (!num) return <>—</>;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="hidden font-num sm:inline" dir="ltr">{num}</span>
      <a href={`tel:${num}`} aria-label="اتصال" title="اتصال" className="inline-grid h-8 w-8 place-items-center rounded-full bg-navy-100 text-navy-700 hover:bg-navy-200">📞</a>
      {wa && (
        <a href={`https://wa.me/${waPhone(num)}`} target="_blank" rel="noopener noreferrer" aria-label="واتساب" title="واتساب" className="inline-grid h-8 w-8 place-items-center rounded-full bg-success/15 text-success hover:bg-success/25">💬</a>
      )}
    </span>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const locale = (await getLocale()) as 'ar' | 'en';
  const listingId = await resolveListingId(id);
  const land = listingId ? await getLandDetail(listingId, locale) : null;
  if (!land) return { title: locale === 'en' ? 'Al Sawarey' : 'الصواري' };
  const desc = [land.typeAr, ...land.specs.slice(0, 4).map((s) => `${s.label}: ${s.value}`)].filter(Boolean).join(' · ').slice(0, 160);
  return pageMeta({
    title: `${land.title} — ${locale === 'en' ? 'Al Sawarey' : 'الصواري'}`,
    description: desc,
    path: land.canonicalPath,
    images: land.gallery.slice(0, 1),
    locale,
  });
}

export default async function LandDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id: param } = await params;
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const listingId = await resolveListingId(param);
  if (!listingId) notFound();
  const land = await getLandDetail(listingId, locale);
  if (!land) notFound();
  // Canonicalize: permanently redirect legacy cuids / mismatched slugs to the SEO URL (308).
  if (decodeURIComponent(param) !== land.canonicalPath.slice('/listings/'.length)) permanentRedirect(land.canonicalPath);
  await trackListingView(listingId); // partner analytics: count the public view
  const [wished, similar, store] = await Promise.all([wishlistListingIds(), similarLands(listingId, 4), getStorefront()]);
  const nb = await prisma.listing.findUnique({
    where: { id: listingId },
    select: {
      neighborhoodId: true,
      hasAllocationLetter: true,
      allocationLetterDate: true,
      hasSaleMandate: true,
      saleMandateDate: true,
      neighborhood: { select: { nameAr: true, nameEn: true, district: { select: { nameAr: true, nameEn: true, city: { select: { nameAr: true, nameEn: true } } } } } },
    },
  });
  // Descriptive alt text for every public photo of this land (image SEO).
  const areaName = nb?.neighborhood ? L(nb.neighborhood.nameAr, nb.neighborhood.nameEn) : null;
  const photoAlt =
    listingAlt(
      {
        type: land.typeAr,
        area: land.actualArea,
        city: nb?.neighborhood?.district?.city ? L(nb.neighborhood.district.city.nameAr, nb.neighborhood.district.city.nameEn) : null,
        district: nb?.neighborhood?.district ? L(nb.neighborhood.district.nameAr, nb.neighborhood.district.nameEn) : null,
        neighborhood: areaName,
      },
      locale,
    ) || land.title;
  const advGroups = await advantagesForNeighborhood(nb?.neighborhoodId, locale);
  const areaUpdates = await updatesForListing(nb?.neighborhoodId);
  const areaPhotos = await customPhotosForListing(nb?.neighborhoodId);
  const areaMaps = await areaMapsForListing(nb?.neighborhoodId, 'alsawarey');
  const genRows = await prisma.attachment.findMany({
    where: { ownerType: 'ListingPoster', ownerId: listingId, stampCategory: { contains: 'alsawarey' } },
    orderBy: { stampCategory: 'asc' },
    select: { path: true, stampCategory: true }, // stampCategory = `${kind}:${brand}` — kind picks the big poster
  });

  // ── Hero gallery (ecommerce-style, one strip at the top): photos → posters → maps ──
  const heroItems: { src: string; label?: string }[] = [];
  const heroSeen = new Set<string>();
  const pushHero = (src: string | null | undefined, label?: string) => {
    if (!src || heroSeen.has(src)) return;
    heroSeen.add(src);
    heroItems.push(label ? { src, label } : { src });
  };
  // Order (owner, 2026-07-16): ① the plot's annotated location map ② the big poster
  // ③ real photos ④ remaining generated cards ⑤ area photos + other inherited maps.
  pushHero(land.locationMap, L('موقع القطعة على المخطط', 'Plot location on the masterplan'));
  const bigPoster = genRows.find((r) => (r.stampCategory ?? '').startsWith('poster'));
  pushHero(bigPoster?.path, L('صورة العرض', 'Listing poster'));
  for (const g of land.gallery) pushHero(g);
  for (const r of genRows) pushHero(r.path, L('صورة العرض', 'Listing poster'));
  for (const p of areaPhotos) pushHero(p.path, p.title || L('صور المنطقة', 'Area photo'));
  for (const mp of areaMaps) {
    // The listing's location map IS the annotated neighborhood masterplan — skip the duplicate.
    if (land.locationMap && mp.level === 'neighborhood' && mp.kind === 'masterplan') continue;
    pushHero(mp.path, `${L(MAP_LEVEL_LABEL[mp.level].ar, MAP_LEVEL_LABEL[mp.level].en)} — ${mp.title || L(MAP_KIND_LABEL[mp.kind]?.ar ?? mp.kind, MAP_KIND_LABEL[mp.kind]?.en ?? mp.kind)}`);
  }

  // Gallery extras (admin-switchable from the portal admin → إعدادات الموقع; default ON):
  // «اسأل عن هذه الصورة» WhatsApp button + first-party photo analytics.
  const galleryFlags = await prisma.setting.findMany({ where: { key: { in: ['gallery.waPhoto', 'gallery.photoAnalytics'] } } });
  const galleryOn = (k: string) => galleryFlags.find((r) => r.key === k)?.value !== '0';
  const heroTrackKey = galleryOn('gallery.photoAnalytics') ? land.id : undefined;
  const isAdminViewer = !!(await getAdminViewer());
  // Cross-domain deep link: the admin panel lives on the portal domain, not this one.
  const portalBase = (process.env.PORTAL_URL || 'https://newobour.com').replace(/\/$/, '');
  const owner = isAdminViewer ? await ownerDetailFor(listingId) : null;
  // Official papers (internal): staff-only on the frontend; the public never sees them.
  const paperPhotos: Record<string, string> = isAdminViewer
    ? Object.fromEntries(
        (await prisma.attachment.findMany({ where: { ownerType: 'ListingPaper', ownerId: listingId }, select: { path: true, stampCategory: true } }))
          .filter((a) => a.stampCategory)
          .map((a) => [a.stampCategory as string, a.path]),
      )
    : {};

  const sold = land.status === 'SOLD';
  const listingUrl = `${BASE}${land.canonicalPath}`;
  const adRef = land.adNumber ? L(` رقم ${land.adNumber}`, ` #${land.adNumber}`) : '';
  // WhatsApp message carries the ad number + a link back to the listing on the site.
  const waText = L(
    `مرحباً، أستفسر عن الأرض${adRef}:\n${land.title}\n${listingUrl}`,
    `Hello, I'm interested in this land${adRef}:\n${land.title}\n${listingUrl}`,
  );
  // «اسأل عن هذه الصورة» in the gallery's fullscreen viewer → storefront WhatsApp.
  const heroWhatsapp =
    galleryOn('gallery.waPhoto') && store.contact.whatsapp
      ? {
          phone: waPhone(store.contact.whatsapp),
          text: L(
            `مرحباً، أستفسر عن هذه الصورة من الإعلان${adRef}:\n${land.title}\n${listingUrl}`,
            `Hello, I'm asking about this photo from the listing${adRef}:\n${land.title}\n${listingUrl}`,
          ),
        }
      : undefined;

  // Group specs into their detail-group (section), preserving section then attribute order.
  const specGroups = land.specs.reduce<{ title: string; items: typeof land.specs }[]>((acc, s) => {
    const title = L(s.sectionAr, s.sectionEn) || L('بيانات الأرض', 'Land details');
    const last = acc[acc.length - 1];
    if (last && last.title === title) last.items.push(s);
    else acc.push({ title, items: [s] });
    return acc;
  }, []);
  const perLabel =
    land.priceUnit === 'UNIT' ? L('للوحدة', 'per unit') : land.priceUnit === 'SQM' ? L('للمتر', 'per m²') : '';
  const priceShort =
    land.price != null ? `${fmt(land.price)} ${L('ج.م', 'EGP')}${perLabel ? ` / ${perLabel}` : ''}` : L('السعر عند الطلب', 'Price on request');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: land.title,
    // ImageObject entries (contentUrl + caption = the photo's alt); first is representativeOfPage.
    image: land.gallery.map((g, i) => ({
      '@type': 'ImageObject',
      contentUrl: `${BASE}${g}`,
      url: `${BASE}${g}`,
      caption: land.gallery.length > 1 ? `${photoAlt} — ${L('صورة', 'photo')} ${i + 1}` : photoAlt,
      ...(i === 0 ? { representativeOfPage: true } : {}),
    })),
    description: land.specs.map((s) => `${s.label}: ${s.value}`).join(' · '),
    category: 'Real Estate Land',
    offers: {
      '@type': 'Offer',
      priceCurrency: 'EGP',
      price: land.price ?? undefined,
      availability: land.status === 'SOLD' ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
      url: `${BASE}${land.canonicalPath}`,
    },
  };
  const crumbsLd = breadcrumbLd([
    { name: L('الرئيسية', 'Home'), path: '/' },
    { name: L('كل الأراضي', 'All lands'), path: '/listings' },
    { name: land.title, path: land.canonicalPath },
  ]);

  return (
    <StoreShell>
      {/* Escape "<" so seller-authored fields (name/description) can't break out of the script tag. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson([jsonLd, crumbsLd]) }} />
      <TrackView item={{ id: land.id, title: land.title, cover: land.gallery[0] ? thumbUrl(land.gallery[0], 320) : null, price: land.price != null ? String(land.price) : null, href: land.canonicalPath }} />
      <div className="mx-auto max-w-5xl px-4 pt-6 pb-24 lg:pb-6">
        <Link href="/listings" className="text-sm text-navy-600">‹ {L('كل الأراضي', 'All lands')}</Link>

        <div className="mt-3 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <HeroGallery items={heroItems} alt={photoAlt} locale={locale} whatsapp={heroWhatsapp} trackKey={heroTrackKey} />
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl bg-white p-5 shadow-md">
              {sold && <span className="mb-2 inline-block rounded-lg bg-danger px-3 py-1 text-xs font-bold text-white">{L('تم البيع', 'Sold')}</span>}
              <div className="flex items-start justify-between gap-2">
                <div>
                  {land.adNumber && <div className="font-num text-sm text-ink-400" dir="ltr">#{land.adNumber}</div>}
                  <h1 className="text-2xl font-black text-navy-800">{land.title}</h1>
                </div>
                <WishlistButton listingId={land.id} initialSaved={wished.has(land.id)} size="lg" locale={locale} />
              </div>
              {land.typeAr && <p className="mt-1 text-ink-500">{land.typeAr}</p>}
              {land.actualArea != null && (
                <p className="mt-1 text-lg font-semibold text-navy-800">
                  {L('المساحة الفعلية', 'Actual area')}: {land.actualArea} {L('م²', 'm²')}
                </p>
              )}

              <div className="mt-4 border-t border-ink-100 pt-4">
                {sold ? (
                  land.soldPrice != null ? (
                    <div className="font-num text-2xl font-black text-danger">{fmt(land.soldPrice)} <span className="text-base">{L('ج.م', 'EGP')}</span></div>
                  ) : (
                    <div className="text-lg font-bold text-ink-500">{L('تم البيع', 'Sold')}</div>
                  )
                ) : land.price != null ? (
                  <div className="font-num text-3xl font-black text-navy-800">{fmt(land.price)} <span className="text-lg text-ink-500">{L('ج.م', 'EGP')}{perLabel ? ` / ${perLabel}` : ''}</span></div>
                ) : (
                  <div className="text-lg font-bold text-gold-700">{L('السعر عند الطلب', 'Price on request')}</div>
                )}
                {!sold && land.priceNegotiable && (
                  <span className="mt-1 inline-block rounded bg-gold-100 px-2 py-0.5 text-xs font-bold text-gold-800">{L('قابل للتفاوض', 'Negotiable')}</span>
                )}
                {land.priceNote && <p className="mt-1 text-sm text-ink-500">{land.priceNote}</p>}
              </div>

              {!sold && (
                <div className="mt-4">
                  <BuyButton listingId={land.id} waText={waText} whatsapp={store.contact.whatsapp} label={L('تواصل معنا بخصوص هذه الأرض', 'Contact us about this land')} labelShort={L('تواصل معنا', 'Contact us')} sentLabel={L('تم الإرسال ✓', 'Sent ✓')} />
                  <p className="mt-2 text-center text-xs text-ink-500">{L('سيتم تحويلك إلى واتساب للتحدث معنا', 'You will be taken to WhatsApp to talk to us')}</p>
                </div>
              )}

              <div className="mt-4 border-t border-ink-100 pt-3">
                <span className="text-xs text-ink-500">{L('شارك هذا الإعلان', 'Share this listing')}</span>
                <ShareButtons url={listingUrl} title={land.title} whatsapp={store.contact.whatsapp} locale={locale} />
              </div>
            </div>
          </aside>
        </div>

        {/* Owner details — staff only. Compact single-row band: the title sits inline with
            the fields (which size to their content). Seller + Type dropped; the 2nd phone is
            hidden when the owner has only one number. */}
        {owner && (
          <section className="mt-6 rounded-2xl border-2 border-amber-400 bg-amber-50 px-5 py-3 text-navy-800">
            <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
              <span className="flex items-center gap-1.5 whitespace-nowrap font-bold text-amber-800">🔒 {L('بيانات المالك', 'Owner details')}</span>
              <dl className="flex flex-wrap items-center gap-x-8 gap-y-2">
                <div className="flex items-baseline gap-1.5"><dt className="text-xs text-ink-500">{L('المالك', 'Owner')}</dt><dd className="whitespace-nowrap font-semibold">{owner.ownerName ?? '—'}</dd></div>
                <div className="flex items-center gap-1.5"><dt className="text-xs text-ink-500">{L('هاتف ١', 'Phone 1')}</dt><dd className="whitespace-nowrap"><OwnerPhone num={owner.phone1} wa={owner.phone1Whatsapp} /></dd></div>
                {owner.phone2 && (
                  <div className="flex items-center gap-1.5"><dt className="text-xs text-ink-500">{L('هاتف ٢', 'Phone 2')}</dt><dd className="whitespace-nowrap"><OwnerPhone num={owner.phone2} wa={owner.phone2Whatsapp} /></dd></div>
                )}
                <div className="flex items-baseline gap-1.5"><dt className="text-xs text-ink-500">{L('أضافه', 'Added by')}</dt><dd className="whitespace-nowrap font-semibold">{owner.createdByName ?? '—'}</dd></div>
              </dl>
              {/* Staff-only deep link to the backend edit page (portal domain). */}
              <a
                href={`${portalBase}/admin/marketplace/listings/${listingId}/edit`}
                className="ms-auto inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border-2 border-amber-400 bg-white px-4 py-1.5 text-sm font-bold text-amber-800 hover:bg-amber-100"
              >
                ✎ {L('تعديل (إدارة)', 'Edit (staff)')}
              </a>
            </div>
            {owner.details && <p className="mt-2 border-t border-amber-200 pt-2 text-sm text-navy-700">{owner.details}</p>}
          </section>
        )}

        {/* Official papers (internal) — staff only; hidden from the public. */}
        {isAdminViewer && nb && (
          <section className="mt-6 rounded-2xl border-2 border-amber-400 bg-amber-50 px-5 py-4 text-navy-800">
            <div className="mb-3 flex items-center gap-1.5 font-bold text-amber-800">🗂️ {L('الأوراق الرسمية (للإدارة فقط)', 'Official papers (staff only)')}</div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: L('جواب التحصيص', 'Allocation letter'), has: nb.hasAllocationLetter, date: nb.allocationLetterDate, photo: paperPhotos['allocation_letter'] },
                { label: L('توكيل بيع', 'Sale mandate'), has: nb.hasSaleMandate, date: nb.saleMandateDate, photo: paperPhotos['sale_mandate'] },
              ].map((p, i) => (
                <div key={i} className="rounded-xl border border-amber-200 bg-white/70 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{p.label}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${p.has ? 'bg-success/15 text-success' : 'bg-ink-100 text-ink-500'}`}>
                      {p.has ? L('متوفر', 'Available') : L('غير متوفر', 'Not available')}
                    </span>
                  </div>
                  {p.has && p.date && <div className="mt-1 font-num text-xs text-ink-500" dir="ltr">{p.date}</div>}
                  {p.has && p.photo && (
                    <a href={p.photo} target="_blank" rel="noreferrer" className="mt-2 block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.photo} alt="" className="h-28 w-full rounded-lg object-cover ring-1 ring-ink-100" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Location map, area photos & area maps moved into the hero gallery at the top (2026-07-16). */}
        {advGroups.length > 0 && (
          <div className="mt-6 rounded-2xl bg-white p-5 shadow-md">
            <AreaAdvantages heading={L('مميزات المنطقة', 'Area advantages')} groups={advGroups} />
          </div>
        )}

        {/* Inherited area content (geo.inheritance matrix — updates.toListing / maps.toListing).
            Collapsed by default so the listing itself stays the star. */}
        {areaUpdates.length > 0 && (
          <details className="mt-6 rounded-2xl bg-white p-5 shadow-md">
            <summary className="cursor-pointer text-lg font-bold text-navy-800">{L('عن المنطقة', 'About the area')}</summary>
            <div className="mt-3 space-y-6">
              {areaUpdates.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-navy-800">{L('آخر التحديثات', 'Latest updates')}</h3>
                  <ul className="space-y-2">
                    {areaUpdates.map((u) => (
                      <li key={u.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-ink-100 p-3 text-sm">
                        <span className="rounded bg-gold/15 px-2 py-0.5 text-xs font-semibold text-navy-700">
                          {u.source === 'city' ? L('المدينة', 'City') : u.source === 'district' ? L('الحي', 'District') : L('المجاورة', 'Neighborhood')}
                        </span>
                        <span className="font-semibold text-navy-800">{u.title || L('تحديث', 'Update')}</span>
                        <span className="ms-auto font-num text-xs text-ink-500" dir="ltr">
                          {new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(u.happenedAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </details>
        )}

        {specGroups.map((g) => (
          <section key={g.title} className="mt-6 rounded-2xl bg-white p-5 shadow-md">
            <h2 className="mb-3 text-lg font-bold text-navy-800">{g.title}</h2>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              {g.items.map((s) => (
                <div key={s.label} className="flex justify-between gap-3 border-b border-ink-100 pb-2">
                  <dt className="text-sm text-ink-500">{s.label}</dt>
                  <dd className="text-sm font-medium text-navy-800">
                    {s.link === 'url' ? (
                      <a href={/^https?:\/\//i.test(s.value) ? s.value : `https://${s.value}`} target="_blank" rel="noopener noreferrer" dir="ltr" className="text-gold-700 underline">{s.value}</a>
                    ) : s.link === 'tel' ? (
                      <a href={`tel:${s.value.replace(/\s/g, '')}`} dir="ltr" className="text-gold-700 underline">{s.value}</a>
                    ) : (
                      s.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}

        {land.description && (
          <section className="mt-6 rounded-2xl bg-white p-5 shadow-md">
            <h2 className="mb-2 text-lg font-bold text-navy-800">{L('الوصف', 'Description')}</h2>
            {/<\w/.test(land.description) ? (
              <div className="page-content leading-relaxed text-ink-700" dangerouslySetInnerHTML={{ __html: land.description }} />
            ) : (
              <p className="whitespace-pre-line leading-relaxed text-ink-700">{land.description}</p>
            )}
          </section>
        )}

        {land.conditions.length > 0 && (
          <details className="mt-6 rounded-2xl bg-white p-5 shadow-md">
            <summary className="cursor-pointer text-lg font-bold text-navy-800">{L('اشتراطات البناء', 'Building conditions')}</summary>
            <div className="mt-3 space-y-6">
              {land.conditions.map((c) => (
                <div key={c.slug}>
                  <h3 className="mb-2 font-bold text-navy-800">{c.title}</h3>
                  <div className="page-content leading-relaxed text-ink-700" dangerouslySetInnerHTML={{ __html: c.body }} />
                </div>
              ))}
            </div>
          </details>
        )}

        {land.amenities.length > 0 && (
          <section className="mt-6 rounded-2xl bg-white p-5 shadow-md">
            <h2 className="mb-3 text-lg font-bold text-navy-800">{L('مرافق المنطقة', 'Area amenities')}</h2>
            <ul className="space-y-3">
              {land.amenities.map((a, i) => (
                <li key={i} className="border-b border-ink-100 pb-3 last:border-0 last:pb-0">
                  <span className="rounded bg-navy-50 px-2 py-0.5 text-xs text-navy-700">{a.type}</span>
                  <span className="ms-2 font-semibold text-navy-800">{a.title}</span>
                  {a.details && <p className="mt-1 whitespace-pre-line text-sm text-ink-600">{a.details}</p>}
                  {a.photos.length > 0 && <div className="mt-2"><PhotoGallery photos={a.photos} alt={geoPhotoAlt(areaName, a.title, locale)} locale={locale} /></div>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {similar.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-4 text-xl font-bold text-navy-800 dark:text-soft">{L('أراضٍ مشابهة', 'Similar lands')}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {similar.map((s) => <StoreLandCard key={s.id} land={s} locale={locale} wishlisted={wished.has(s.id)} />)}
            </div>
          </section>
        )}
      </div>

      {/* Mobile sticky action bar — keeps the price + buy CTA reachable without scrolling
          back to the top. Hidden on lg where the sidebar CTA is always in view. */}
      {!sold && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-ink-200 bg-white p-3 shadow-lg lg:hidden">
          <div className="min-w-0 flex-1 truncate font-num text-lg font-black text-navy-800">{priceShort}</div>
          <div className="w-40 flex-none">
            <BuyButton listingId={land.id} waText={waText} whatsapp={store.contact.whatsapp} label={L('تواصل معنا', 'Contact us')} sentLabel={L('تم الإرسال ✓', 'Sent ✓')} />
          </div>
        </div>
      )}
    </StoreShell>
  );
}
