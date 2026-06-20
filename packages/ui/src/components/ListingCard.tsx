// Presentational listing card shared by the marketplace grid (portal) and the
// brokerage inventory grid. Pure props — locale-aware strings are resolved by the caller.
export function ListingCard({
  href,
  cover,
  title,
  subtitle,
  price,
  currency = 'ج.م',
}: {
  href: string;
  cover?: string | null;
  title: string;
  subtitle?: string;
  price?: string | null;
  currency?: string;
}) {
  return (
    <a href={href} className="block overflow-hidden rounded-lg border border-graphite/15 transition-colors hover:border-accent">
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover} alt="" className="h-40 w-full object-cover" />
      ) : (
        <div className="h-40 w-full bg-graphite/10" />
      )}
      <div className="space-y-1 p-3">
        <div className="font-semibold">{title}</div>
        {subtitle ? <div className="text-xs opacity-70">{subtitle}</div> : null}
        {price != null && price !== '' ? (
          <div className="font-bold text-primary">{price} <span className="text-xs font-normal">{currency}</span></div>
        ) : null}
      </div>
    </a>
  );
}
