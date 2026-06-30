import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { PhotoGallery } from '@noc/ui';
import { StoreShell } from '../../_components/StoreShell';
import { StoreLandCard } from '../../_components/StoreLandCard';
import { getLandDetail, similarLands } from '../../../lib/listings';
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

  const sold = land.status === 'SOLD';
  const waText = L(
    `مرحباً، أريد شراء الأرض: ${land.title}`,
    `Hello, I'm interested in buying: ${land.title}`,
  );

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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mx-auto max-w-5xl px-4 py-6">
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
                  <div className="font-num text-3xl font-black text-navy-800">{fmt(land.price)} <span className="text-lg text-ink-500">{L('ج.م', 'EGP')}</span></div>
                ) : (
                  <div className="text-lg font-bold text-gold-700">{L('السعر عند الطلب', 'Price on request')}</div>
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
          </aside>
        </div>

        {land.specs.length > 0 && (
          <section className="mt-6 rounded-2xl bg-white p-5 shadow-md">
            <h2 className="mb-3 text-lg font-bold text-navy-800">{L('بيانات الأرض', 'Land details')}</h2>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              {land.specs.map((s) => (
                <div key={s.label} className="flex justify-between gap-3 border-b border-ink-100 pb-2">
                  <dt className="text-sm text-ink-500">{s.label}</dt>
                  <dd className="text-sm font-medium text-navy-800">{s.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {land.description && (
          <section className="mt-6 rounded-2xl bg-white p-5 shadow-md">
            <h2 className="mb-2 text-lg font-bold text-navy-800">{L('الوصف', 'Description')}</h2>
            <p className="whitespace-pre-line leading-relaxed text-ink-700">{land.description}</p>
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
    </StoreShell>
  );
}
