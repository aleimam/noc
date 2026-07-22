/** Pure state machine for the partner fast-edit availability switches.
 *
 *  `Listing.status` is ONE column (PUBLISHED | SOLD | ARCHIVED), but the UI exposes two
 *  independent switches — sale state and visibility. Hiding therefore has to REMEMBER what the
 *  listing was, otherwise un-hiding a sold listing silently returns it to «متاح» and the seller
 *  re-lists something already sold.
 *
 *  Kept pure (no Prisma, no I/O) so the transition matrix is unit-tested — see availability.test.ts.
 */
export type FastStatus = 'PUBLISHED' | 'SOLD' | 'ARCHIVED';

export type AvailabilityTransition = {
  /** Status to write. Differs from the requested one when un-hiding restores a remembered SOLD. */
  status: FastStatus;
  /** Value for Listing.statusBeforeHide (null clears it). */
  statusBeforeHide: string | null;
  /** Present only when soldPrice should change; absent = leave the stored figure untouched. */
  soldPrice?: number | null;
};

export function resolveAvailabilityTransition(
  current: { status: string; statusBeforeHide?: string | null },
  requested: FastStatus,
  parsedSoldPrice: number | null,
): AvailabilityTransition {
  // Hiding = pause. Record what it was and DON'T touch soldPrice — nulling it here meant even a
  // manual re-mark after un-hiding lost the agreed figure.
  if (requested === 'ARCHIVED') {
    return {
      status: 'ARCHIVED',
      statusBeforeHide: current.status === 'SOLD' ? 'SOLD' : 'PUBLISHED',
    };
  }

  // Un-hiding: restore what it was. Rows hidden before this column existed have no memory, so
  // they fall back to PUBLISHED — exactly the previous behaviour, no regression.
  if (requested === 'PUBLISHED' && current.status === 'ARCHIVED') {
    const restored: FastStatus = current.statusBeforeHide === 'SOLD' ? 'SOLD' : 'PUBLISHED';
    return {
      status: restored,
      statusBeforeHide: null,
      // Coming back as SOLD keeps the price that was preserved while hidden.
      ...(restored === 'SOLD' ? {} : { soldPrice: null }),
    };
  }

  // Ordinary available <-> sold flip.
  return {
    status: requested,
    statusBeforeHide: null,
    soldPrice: requested === 'SOLD' ? parsedSoldPrice : null,
  };
}
