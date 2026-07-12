import { prisma } from '@noc/db';

export const dynamic = 'force-dynamic';

/** IndexNow ownership-proof key file (https://www.indexnow.org). The key is generated
 *  lazily by the first ping (portal lib/indexnow.ts) and shared by both sites; 404 until then. */
export async function GET() {
  const row = await prisma.setting.findUnique({ where: { key: 'indexnow_key' } });
  if (!row?.value) return new Response(null, { status: 404 });
  return new Response(row.value, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
