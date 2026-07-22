/**
 * Staff-only strip shown on the PUBLIC listing surfaces of both sites when the viewer is in
 * admin view. Deliberately amber + 🔒 so it can never be mistaken for something a visitor sees.
 *
 * Pure props (house convention) — the caller resolves every string, including the already
 * formatted floor price. Callers MUST gate rendering on their app's admin check; this component
 * has no authorisation of its own.
 */
export function AdminInfoStrip({
  ownerName,
  phone,
  lowestPrice,
  floorLabel,
  currency,
  compact = false,
}: {
  ownerName?: string | null;
  phone?: string | null;
  /** Pre-formatted number, or null when no floor price is recorded. */
  lowestPrice?: string | null;
  floorLabel: string;
  currency?: string;
  /** true on card grids (tighter type), false on detail pages. */
  compact?: boolean;
}) {
  const hasOwner = !!(ownerName || phone);
  if (!hasOwner && !lowestPrice) return null;
  return (
    <div
      dir="auto"
      className={`rounded-md border border-amber-300 bg-amber-50 text-amber-900 ${compact ? 'px-2 py-1 text-[11px]' : 'px-3 py-2 text-sm'}`}
    >
      {hasOwner && (
        <div className="font-medium">
          🔒 {ownerName || '—'}
          {phone ? (
            <>
              {' · '}
              <span className="font-num" dir="ltr">{phone}</span>
            </>
          ) : null}
        </div>
      )}
      {lowestPrice ? (
        <div className={`${hasOwner ? 'mt-0.5' : ''} font-bold`}>
          {floorLabel}:{' '}
          <span className="font-num" dir="ltr">{lowestPrice}</span>
          {currency ? ` ${currency}` : ''}
        </div>
      ) : null}
    </div>
  );
}
