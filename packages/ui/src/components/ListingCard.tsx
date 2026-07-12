import type { ReactNode } from 'react';

/** Marketplace listing card — DS PropertyCard look: 16:10 media, soft-rounded,
 *  navy-tinted lift on hover, Playfair price. Pure props; strings resolved by caller. */
export function ListingCard({
  href,
  cover,
  title,
  subtitle,
  price,
  currency = 'ج.م',
  badge,
  meta,
  alt,
  listingId,
}: {
  href: string;
  cover?: string | null;
  title: string;
  subtitle?: string;
  price?: string | null;
  currency?: string;
  badge?: ReactNode; // e.g. a <Badge> overlaid on the media
  meta?: ReactNode; // a small line under the title (location, etc.)
  alt?: string; // cover alt text (image SEO); defaults to the listing title
  listingId?: string; // when set, exposes data-listing-id for search select-tracking
}) {
  return (
    <a
      href={href}
      data-listing-id={listingId}
      className="group flex flex-col overflow-hidden rounded-lg border border-ink-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-navy-100">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt={alt ?? title} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-navy-300">
            <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
              <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-3" />
              <path d="M9 9v.01M9 12v.01M9 15v.01M9 18v.01" />
            </svg>
          </div>
        )}
        {badge ? <div className="absolute start-3 top-3">{badge}</div> : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="font-bold text-navy-800">{title}</div>
        {subtitle ? <div className="text-sm text-ink-500">{subtitle}</div> : null}
        {meta ? <div className="text-sm text-ink-500">{meta}</div> : null}
        {price != null && price !== '' ? (
          <div className="mt-auto flex items-baseline gap-1.5 pt-1">
            <span className="font-num text-2xl font-bold text-navy-800">{price}</span>
            <span className="text-sm font-semibold text-ink-500">{currency}</span>
          </div>
        ) : null}
      </div>
    </a>
  );
}
