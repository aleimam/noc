import { permanentRedirect } from 'next/navigation';

// Legacy URL — single plots moved from /rationing/plot?ref=<ref> to /rationing/plots/<ref> (308).
export const dynamic = 'force-dynamic';

export default async function LegacyPlotRedirect({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const ref = (typeof sp.ref === 'string' ? sp.ref : '').trim();
  permanentRedirect(ref ? `/rationing/plots/${encodeURIComponent(ref)}` : '/rationing/plots');
}
