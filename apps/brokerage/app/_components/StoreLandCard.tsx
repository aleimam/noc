import Link from 'next/link';
import type { LandCard } from '../../lib/listings';
import { WishlistButton } from './WishlistButton';

const fmt = (n: number) => n.toLocaleString('en');

export function StoreLandCard({ land, locale, wishlisted = false }: { land: LandCard; locale: 'ar' | 'en'; wishlisted?: boolean }) {
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const sold = land.status === 'SOLD';
  const meta = [
    land.area ? `${fmt(land.area)} ${L('م²', 'm²')}` : null,
    land.districtAr,
    land.cityAr,
  ].filter(Boolean).join(' · ');

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
      <div className="absolute end-3 top-3 z-10">
        <WishlistButton listingId={land.id} initialSaved={wishlisted} />
      </div>
      <Link href={`/listings/${land.id}`} className="flex flex-1 flex-col">
        <div className="relative aspect-[16/10] overflow-hidden bg-navy-100">
          {land.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={land.cover} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-3xl text-navy-300" aria-hidden>🏞</div>
          )}
          {sold && <span className="absolute start-3 top-3 rounded-lg bg-danger px-3 py-1 text-xs font-bold text-white">{L('تم البيع', 'Sold')}</span>}
          {!sold && (
            <div className="absolute start-3 top-3 flex gap-1.5">
              {land.corner && <span className="rounded-md bg-gold px-2 py-0.5 text-[11px] font-bold text-navy-900">{L('ناصية', 'Corner')}</span>}
              {land.onMainStreet && <span className="rounded-md bg-navy-700 px-2 py-0.5 text-[11px] font-bold text-white">{L('شارع رئيسي', 'Main rd')}</span>}
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-1.5 p-4">
          {land.adNumber && <div className="font-num text-xs text-ink-400" dir="ltr">#{land.adNumber}</div>}
          <div className="font-bold text-navy-800 line-clamp-1">{land.title}</div>
          {meta && <div className="text-xs text-ink-500">{meta}</div>}
          <div className="mt-auto pt-1">
            {sold ? (
              land.soldPrice != null ? (
                <span className="font-num text-lg font-bold text-danger">{fmt(land.soldPrice)} <span className="text-sm">{L('ج.م', 'EGP')}</span></span>
              ) : (
                <span className="text-sm font-semibold text-ink-500">{L('تم البيع', 'Sold')}</span>
              )
            ) : land.price != null ? (
              <span className="font-num text-xl font-bold text-navy-800">{fmt(land.price)} <span className="text-sm text-ink-500">{L('ج.م', 'EGP')}</span></span>
            ) : (
              <span className="text-sm font-semibold text-gold-700">{L('السعر عند الطلب', 'Price on request')}</span>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}
