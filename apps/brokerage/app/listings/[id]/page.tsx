import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { PhotoGallery } from '@noc/ui';
import { StoreShell } from '../../_components/StoreShell';
import { StoreLandCard } from '../../_components/StoreLandCard';
import { getLandDetail, similarLands } from '../../../lib/listings';
import { getAdminViewer, ownerDetailFor } from '../../../lib/adminView';
import { wishlistListingIds } from '../../../lib/wishlist';
import { getStorefront } from '../../../lib/storefront';
import { BuyButton } from './BuyButton';
import { WishlistButton } from '../../_components/WishlistButton';

export const dynamic = 'force-dynamic';
const fmt = (n: number) => n.toLocaleString('en');
const BASE = (process.env.BROKERAGE_URL || 'https://alsawarey.com').replace(/\/$/, '');

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const land = await getLandDetail(id, 'ar');
  if (!land) return { title: 'الصواري' };
  const desc = [land.typeAr, ...land.specs.slice(0, 4).map((s) => `${s.label}: ${s.value}`)].filter(Boolean).join(' · ');
  const img = land.gallery[0] ? `${BASE}${land.gallery[0]}` : undefined;
  return {
    title: `${land.title} — الصواري`,
    description: desc.slice(0, 160),
    openGraph: { title: land.title, description: desc.slice(0, 160), images: img ? [img] : [], type: 'website' },
  };
}

export default async function LandDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const land = await getLandDetail(id, locale);
  if (!land) notFound();
  const [wished, similar, store] = await Promise.all([wishlistListingIds(), similarLands(id, 4), getStorefront()]);
  const owner = (await getAdminViewer()) ? await ownerDetailFor(id) : null;
  const ownerTypeLabel: Record<string, string> = { PERSONAL: L('فرد', 'Personal'), COMPANY: L('شركة', 'Company'), BROKER: L('سمسار', 'Broker'), US: L('نحن', 'Us') };

  const sold = land.status === 'SOLD';
  const waText = L(
    `مرحباً، أريد شراء الأرض: ${land.title}`,
    `Hello, I'm interested in buying: ${land.title}`,
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

  return (
    <StoreShell>
      {/* Escape "<" so seller-authored fields (name/description) can't break out of the script tag. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <div className="mx-auto max-w-5xl px-4 pt-6 pb-24 lg:pb-6">
        <Link href="/listings" className="text-sm text-navy-600">‹ {L('كل الأراضي', 'All lands')}</Link>

        <div className="mt-3 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div>
            {land.gallery.length > 0 ? (
              <PhotoGallery photos={land.gallery} />
            ) : (
              <div className="flex aspect-[16/10] items-center justify-center rounded-2xl bg-navy-100 text-4xl text-navy-300" aria-hidden>🏞</div>
            )}
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
                  <BuyButton listingId={land.id} waText={waText} whatsapp={store.contact.whatsapp} label={L('أريد شراءها', 'I want to buy it')} sentLabel={L('تم الإرسال ✓', 'Sent ✓')} />
                  <p className="mt-2 text-center text-xs text-ink-500">{L('سيتم تحويلك إلى واتساب لإتمام الطلب', 'You will be taken to WhatsApp to continue')}</p>
                </div>
              )}
            </div>

            {owner && (
              <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-5 text-navy-800">
                <div className="mb-2 flex items-center gap-2 text-sm font-bold text-amber-800">🔒 {L('بيانات المالك (للمشرفين فقط)', 'Owner details (staff only)')}</div>
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-ink-500">{L('المالك', 'Owner')}</dt><dd className="font-medium">{owner.ownerName ?? '—'}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-ink-500">{L('النوع', 'Type')}</dt><dd className="font-medium">{owner.ownerType ? ownerTypeLabel[owner.ownerType] ?? owner.ownerType : '—'}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-ink-500">{L('هاتف ١', 'Phone 1')}</dt><dd className="font-num font-medium" dir="ltr">{owner.phone1 ? `${owner.phone1}${owner.phone1Whatsapp ? ' (WA)' : ''}` : '—'}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-ink-500">{L('هاتف ٢', 'Phone 2')}</dt><dd className="font-num font-medium" dir="ltr">{owner.phone2 ? `${owner.phone2}${owner.phone2Whatsapp ? ' (WA)' : ''}` : '—'}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-ink-500">{L('البائع', 'Seller')}</dt><dd className="font-medium">{owner.sellerName ?? '—'}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-ink-500">{L('أضافه', 'Added by')}</dt><dd className="font-medium">{owner.createdByName ?? '—'}</dd></div>
                </dl>
                {owner.details && <p className="mt-2 border-t border-amber-200 pt-2 text-sm text-navy-700">{owner.details}</p>}
              </div>
            )}
          </aside>
        </div>

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
            <BuyButton listingId={land.id} waText={waText} whatsapp={store.contact.whatsapp} label={L('أريد شراءها', 'I want to buy it')} sentLabel={L('تم الإرسال ✓', 'Sent ✓')} />
          </div>
        </div>
      )}
    </StoreShell>
  );
}
