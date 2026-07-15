/**
 * One-time: seed the new 'map-newobour' stamp category from the existing shared 'map' config,
 * so New Obour map copies keep their CURRENT look after the per-site map split. We copy the
 * format (position/opacity/scale/footer/enabled) but clear logoPath → logoForCategory then
 * resolves the New Obour brand logo, exactly as before. Idempotent: skips if already present.
 *
 * Usage:  npx dotenv -e .env -- tsx ops/seed-map-newobour.ts
 */
import { prisma } from '@noc/db';

const KEY = 'stamp.config';

async function main() {
  const row = await prisma.setting.findUnique({ where: { key: KEY } });
  if (!row?.value) {
    console.log('no stamp.config setting — nothing to seed (defaults apply)');
    return;
  }
  const s = JSON.parse(row.value) as { categories?: Record<string, unknown> };
  s.categories = s.categories ?? {};
  if (s.categories['map-newobour']) {
    console.log('map-newobour already configured — no change');
    return;
  }
  const map = s.categories['map'] as Record<string, unknown> | undefined;
  if (!map) {
    console.log('no map config to copy — map-newobour will use defaults (off)');
    return;
  }
  s.categories['map-newobour'] = { ...map, logoPath: null };
  await prisma.setting.update({ where: { key: KEY }, data: { value: JSON.stringify(s) } });
  console.log('seeded map-newobour from map (logo cleared → New Obour brand logo):', JSON.stringify(s.categories['map-newobour']));
}

main().then(
  () => process.exit(0),
  (e) => { console.error(e); process.exit(1); },
);
