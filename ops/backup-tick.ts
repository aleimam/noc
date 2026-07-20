// Off-site backup scheduler tick. Cron runs this every 10 minutes; the APP decides
// which levels are due (packages/backup logic), so cadence lives in the DB and the
// cron stays dumb. Wrapper: ops/backup-tick.sh; cron /etc/cron.d/noc-backup-tick.
//
// Imports the service directly (NOT via a Next-only path) — see the 'server-only'
// note at the top of packages/backup/src/service.ts.
import { runDueBackups } from '../packages/backup/src/service';

async function main() {
  const { ran, results } = await runDueBackups();
  if (ran === 0) {
    console.log(`${new Date().toISOString()} backup-tick: nothing due`);
    return;
  }
  for (const r of results) console.log(`${new Date().toISOString()} backup-tick: ${r.tier} -> ${r.status}`);
  if (results.some((r) => r.status === 'FAILED')) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error('backup-tick failed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { prisma } = await import('@noc/db');
    await prisma.$disconnect();
  });
