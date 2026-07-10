import { NextResponse, type NextRequest } from 'next/server';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import { requirePermission } from '@noc/auth';
import { BACKUP_ROOT } from '../backups';

export const dynamic = 'force-dynamic';

// Only DB dumps + uploads archives are downloadable. The `config` snapshots are the raw
// .env (DB password, auth secret, API keys) — never expose those over the browser; grab
// them via SSH if ever needed.
const DIRS: Record<string, string> = { db: 'db', uploads: 'uploads' };
const NAME_OK = /^[A-Za-z0-9._-]+\.(sql\.gz|tar\.gz)$/;

/** GET /admin/settings/backups/download?kind=db|uploads&file=<name> → streams the file. */
export async function GET(req: NextRequest) {
  await requirePermission('settings', 'VIEW');

  const kind = req.nextUrl.searchParams.get('kind') ?? '';
  const name = req.nextUrl.searchParams.get('file') ?? '';
  const sub = DIRS[kind];
  if (!sub || !NAME_OK.test(name) || name.includes('/') || name.includes('..')) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const base = path.join(BACKUP_ROOT, sub);
  const full = path.join(base, name);
  if (full !== path.join(base, path.basename(name))) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const st = await stat(full).catch(() => null);
  if (!st?.isFile()) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const stream = Readable.toWeb(createReadStream(full)) as unknown as ReadableStream;
  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'application/gzip',
      'Content-Length': String(st.size),
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'no-store',
    },
  });
}
