/**
 * Analytics retention prune — deletes raw visit data older than ANALYTICS_RETENTION_DAYS
 * (default 90). Keeps the tables from growing unbounded once real traffic accumulates.
 *
 * Deleting a VisitSession cascades its PageViews + AnalyticsEvents (FK onDelete: Cascade),
 * so pruning old sessions clears the bulk; orphaned Visitors (no remaining sessions) follow.
 * Sessions are 30-minute windows, so a session's children never predate its lastEventAt by
 * more than that — pruning by lastEventAt is sufficient and leaves no stray rows.
 *
 * Run nightly by cron (/etc/cron.d/noc-analytics-prune → ops/analytics-prune.sh).
 * Run manually:  cd /root/noc && npx dotenv -e .env -- tsx ops/analytics-prune.ts
 */
import { prisma } from '@noc/db';

const DAYS = Math.max(7, Number(process.env.ANALYTICS_RETENTION_DAYS) || 90);

async function main() {
  const cutoff = new Date(Date.now() - DAYS * 86_400_000);
  const sessions = await prisma.visitSession.deleteMany({ where: { lastEventAt: { lt: cutoff } } });
  const visitors = await prisma.visitor.deleteMany({ where: { lastSeen: { lt: cutoff }, sessions: { none: {} } } });
  const stamp = new Date().toISOString();
  console.log(
    `[${stamp}] analytics prune (>${DAYS}d, cutoff ${cutoff.toISOString()}): ` +
      `sessions=${sessions.count} visitors=${visitors.count} (pageviews+events cascaded)`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('analytics prune failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
