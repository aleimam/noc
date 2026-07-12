import { permanentRedirect } from 'next/navigation';

// Legacy URL — the partner marketing page moved to /partner/join (308).
export const dynamic = 'force-dynamic';

export default function LegacyPartnersRedirect() {
  permanentRedirect('/partner/join');
}
