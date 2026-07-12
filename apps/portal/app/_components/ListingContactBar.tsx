'use client';

import { trackConvert } from '@noc/ui';

/**
 * Fixed bottom contact bar for a market listing (WhatsApp + Call). Client component only so
 * tapping a CTA can fire a search `convert` beacon (S2) — the links behave exactly as before
 * (WhatsApp opens in a new tab, Call dials); the beacon is fire-and-forget and never blocks.
 */
export function ListingContactBar({
  listingId,
  waNumber,
  contactPhone,
  contactWhatsapp,
  whatsappLabel,
  callLabel,
}: {
  listingId: string;
  waNumber: string;
  contactPhone: string;
  contactWhatsapp: boolean;
  whatsappLabel: string;
  callLabel: string;
}) {
  const onContact = () => trackConvert('newobour', listingId);
  return (
    <div className="fixed inset-x-0 bottom-0 mx-auto flex max-w-3xl gap-3 border-t border-graphite/15 bg-bg p-3">
      {contactWhatsapp && (
        <a
          href={`https://wa.me/${waNumber}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onContact}
          className="flex-1 rounded-md bg-green px-4 py-3 text-center font-semibold text-white"
        >
          {whatsappLabel}
        </a>
      )}
      <a
        href={`tel:${contactPhone}`}
        onClick={onContact}
        className="flex-1 rounded-md bg-primary px-4 py-3 text-center font-semibold text-soft"
      >
        {callLabel}
      </a>
    </div>
  );
}
