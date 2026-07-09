import type { NextRequest } from 'next/server';
import { requirePermission } from '@noc/auth';
import { parseRange, getRecentSessions } from '../../../../../lib/analytics';

export const dynamic = 'force-dynamic';

const esc = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV export of the sessions in the current filter window (bots excluded). */
export async function GET(req: NextRequest): Promise<Response> {
  await requirePermission('settings', 'VIEW');
  const sp = Object.fromEntries(new URL(req.url).searchParams.entries());
  const range = parseRange(sp);
  const rows = await getRecentSessions(range, 50000);

  const header = ['started_at', 'site', 'country', 'region', 'city', 'device', 'os', 'browser', 'source', 'referrer', 'pages', 'duration_sec', 'entry_path', 'exit_path', 'logged_in'];
  const lines = [header.join(',')];
  for (const s of rows) {
    lines.push([
      s.startedAt.toISOString(), s.site, s.country, s.region, s.city, s.device, s.os, s.browser, s.source, s.referrer,
      s.pageviews, s.durationSec, s.entryPath, s.exitPath, s.userId ? 'yes' : 'no',
    ].map(esc).join(','));
  }
  const csv = '﻿' + lines.join('\n'); // BOM so Excel reads UTF-8

  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="visitors-${range.site}-${range.days}d.csv"`,
    },
  });
}
