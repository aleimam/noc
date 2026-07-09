import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { prisma } from '@noc/db';
import { PhotoGallery, TrackView, AreaAdvantages } from '@noc/ui';
import { StoreShell } from '../../_components/StoreShell';
import { advantagesForNeighborhood } from '../../../lib/advantages';
import { StoreLandCard } from '../../_components/StoreLandCard';
import { getLandDetail, similarLands } from '../../../lib/listings';
import { getAdminViewer, ownerDetailFor } from '../../../lib/adminView';
import { wishlistListingIds } from '../../../lib/wishlist';
import { trackListingView } from '../../../lib/views';
import { getStorefront } from '../../../lib/storefront';
import { pageMeta, breadcrumbLd, ldJson } from '../../../lib/seo';
import { BuyButton } from './BuyButton';
import { HeroGallery } from './HeroGallery';
import { ShareButtons } from './ShareButtons';
import { WishlistButton } from '../../_components/WishlistButton';

export const dynamic = 'force-dynamic';
const fmt = (n: number) => n.toLocaleString('en');
const BASE = (process.env.BROKERAGE_URL || 'https://alsawarey.com').replace(/\/$/, '');

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const locale = (await getLocale()) as 'ar' | 'en';
  const land = await getLandDetail(id, locale);
  if (!land) return { title: locale === 'en' ? 'Al Sawarey' : 'الصواري' };
  const desc = [land.typeAr, ...land.specs.slice(0, 4).map((s) => `${s.label}: ${s.value}`)].filter(Boolean).join(' · ').slice(0, 160);
  return pageMeta({
    title: `${land.title} — ${locale === 'en' ? 'Al Sawarey' : 'الصواري'}`,
    description: desc,
    path: `/listings/${id}`,
    images: land.gallery.slice(0, 1),
    locale,
  });
}

export default async function LandDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const land = await getLandDetail(id, locale);
  if (!land) notFound();
  await trackListingView(id); // partner analytics: count the public view
  const [wished, similar, store] = await Promise.all([wishlistListingIds(), similarLands(id, 4), getStorefront()]);
  const nb = await prisma.listing.findUnique({ where: { id }, select: { neighborhoodId: true } });
  const advGroups = await advantagesForNeighborhood(nb?.neighborhoodId, locale);
  const genRows = await prisma.attachment.findMany({
    where: { ownerType: 'ListingPoster', ownerId: id, stampCategory: { contains: 'alsawarey' } },
    orderBy: { stampCategory: 'asc' },
    select: { path: true },
  });
  const owner = (await getAdminViewer()) ? await ownerDetailFor(id) : null;
  const ownerTypeLabel: Record<string, string> = { PERSONAL: L('فرد', 'Personal'), COMPANY: L('شركة', 'Company'), BROKER: L('سمسار', 'Broker'), US: L('نحن', 'Us') };

  const sold = land.status === 'SOLD';
  const listingUrl = `${BASE}/listings/${land.id}`;
  const adRef = land.adNumber ? L(` رقم ${land.adNumber}`, ` #${land.adNumber}`) : '';
  // WhatsApp message carries the ad number + a link back to the listing on the site.
  const waText = L(
    `مرحباً، أستفسر عن الأرض${adRef}:\n${land.title}\n${listingUrl}`,
    `Hello, I'm interested in this land${adRef}:\n${land.title}\n${listingUrl}`,
  );

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
    image: land.gallery.map((g) => `${BASE}${g}`),
    description: land.specs.map((s) => `${s.label}: ${s.value}`).join(' · '),
    category: 'Real Estate Land',
    offers: {
      '@type': 'Offer',
      priceCurrency: 'EGP',
      price: land.price ?? undefined,
      availability: land.status === 'SOLD' ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
      url: `${BASE}/listings/${land.id}`,
    },
  };
  const crumbsLd = breadcrumbLd([
    { name: L('الرئيسية', 'Home'), path: '/' },
    { name: L('كل الأراضي', 'All lands'), path: '/listings' },
    { name: land.title, path: `/listings/${land.id}` },
  ]);

  return (
    <StoreShell>
      {/* Escape "<" so seller-authored fields (name/description) can't break out of the script tag. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson([jsonLd, crumbsLd]) }} />
      <TrackView item={{ id: land.id, title: land.title, cover: land.gallery[0] ?? null, price: land.price != null ? String(land.price) : null, href: `/listings/${land.id}` }} />
      <div className="mx-auto max-w-5xl px-4 pt-6 pb-24 lg:pb-6">
        <Link href="/listings" className="text-sm text-navy-600">‹ {L('كل الأراضي', 'All lands')}</Link>

        <div className="mt-3 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <HeroGallery photos={land.gallery} alt={land.title} />
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl bg-white p-5 shadow-md">
              {sold && <span className="mb-2 inline-block rounded-lg bg-danger px-3 py-1 text-xs font-bold text-white">{L('تم البيع', 'Sold')}</span>}
              <div className="flex items-start justify-between gap-2">
                <div>
                  {land.adNumber && <div className="font-num text-sm text-ink-400" dir="ltr">#{land.adNumber}</div>}
                  <h1 className="text-2xl font-black text-navy-800">{land.title}</h1>
                </div>
                <WishlistButton listingId={land.id} initialSaved={wished.has(land.id)} size="lg" />
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
                  <BuyButton listingId={land.id} waText={waText} whatsapp={store.contact.whatsapp} label={L('تواصل معنا بخصوص هذه الأرض', 'Contact us about this land')} sentLabel={L('تم الإرسال ✓', 'Sent ✓')} />
                  <p className="mt-2 text-center text-xs text-ink-500">{L('سيتم تحويلك إلى واتساب لإتمام الطلب', 'You will be taken to WhatsApp to continue')}</p>
                </div>
              )}

              <div className="mt-4 border-t border-ink-100 pt-3">
                <span className="text-xs text-ink-500">{L('شارك هذا الإعلان', 'Share this listing')}</span>
                <ShareButtons url={listingUrl} title={land.title} whatsapp={store.contact.whatsapp} />
              </div>
            </div>
          </aside>
        </div>

        {/* Owner details — staff only. Full-width horizontal band (label over value in a grid). */}
        {owner && (
          <section className="mt-6 rounded-2xl border-2 border-amber-400 bg-amber-50 p-5 text-navy-800">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold text-amber-800">🔒 {L('بيانات المالك (للمشرفين فقط)', 'Owner details (staff only)')}</div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
              <div><dt className="text-xs text-ink-500">{L('المالك', 'Owner')}</dt><dd className="font-semibold">{owner.ownerName ?? '—'}</dd></div>
              <div><dt className="text-xs text-ink-500">{L('النوع', 'Type')}</dt><dd className="font-semibold">{owner.ownerType ? ownerTypeLabel[owner.ownerType] ?? owner.ownerType : '—'}</dd></div>
              <div><dt className="text-xs text-ink-500">{L('هاتف ١', 'Phone 1')}</dt><dd className="font-num font-semibold" dir="ltr">{owner.phone1 ? `${owner.phone1}${owner.phone1Whatsapp ? ' (WA)' : ''}` : '—'}</dd></div>
              <div><dt className="text-xs text-ink-500">{L('هاتف ٢', 'Phone 2')}</dt><dd className="font-num font-semibold" dir="ltr">{owner.phone2 ? `${owner.phone2}${owner.phone2Whatsapp ? ' (WA)' : ''}` : '—'}</dd></div>
              <div><dt className="text-xs text-ink-500">{L('البائع', 'Seller')}</dt><dd className="font-semibold">{owner.sellerName ?? '—'}</dd></div>
              <div><dt className="text-xs text-ink-500">{L('أضافه', 'Added by')}</dt><dd className="font-semibold">{owner.createdByName ?? '—'}</dd></div>
            </dl>
            {owner.details && <p className="mt-3 border-t border-amber-200 pt-3 text-sm text-navy-700">{owner.details}</p>}
          </section>
        )}

        {land.locationMap && (
          <section className="mt-6 rounded-2xl bg-white p-5 shadow-md">
            <h2 className="mb-3 text-lg font-bold text-navy-800">{L('الموقع على الخريطة', 'Location on the map')}</h2>
            <HeroGallery photos={[land.locationMap]} alt={L('موقع القطعة على المخطط', 'Plot location on the masterplan')} />
            <p className="mt-2 text-center text-sm text-ink-500">{L('خريطة المجاورة موضّح عليها موقع القطعة', 'Neighborhood masterplan with the plot marked')}</p>
          </section>
        )}

        {advGroups.length > 0 && (
          <div className="mt-6 rounded-2xl bg-white p-5 shadow-md">
            <AreaAdvantages heading={L('مميزات المنطقة', 'Area advantages')} groups={advGroups} />
          </div>
        )}

        {genRows.length > 0 && (
          <div className="mt-6 rounded-2xl bg-white p-5 shadow-md">
            <h2 className="mb-3 text-lg font-bold text-navy-800">{L('صور العرض', 'Listing posters')}</h2>
            <PhotoGallery photos={genRows.map((r) => r.path)} />
          </div>
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
                  {a.photos.length > 0 && <div className="mt-2"><PhotoGallery photos={a.photos} /></div>}
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
            <BuyButton listingId={land.id} waText={waText} whatsapp={store.contact.whatsapp} label={L('تواصل معنا بخصوص هذه الأرض', 'Contact us about this land')} sentLabel={L('تم الإرسال ✓', 'Sent ✓')} />
          </div>
        </div>
      )}
    </StoreShell>
  );
}
