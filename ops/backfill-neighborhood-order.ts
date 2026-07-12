/**
 * Backfill Neighborhood.order from the number embedded in nameAr, so every list / dropdown /
 * picker that sorts neighborhoods by `order` shows them numerically (مجاورة 1، 2، 3 … 10، 11 …)
 * instead of by id or alphabetically (where "10" sorts before "2").
 *
 * For each neighborhood we parse the first integer in nameAr — handling ASCII digits (0-9),
 * Arabic-Indic digits (٠-٩) and Extended/Persian Arabic-Indic digits (۰-۹). If a number is
 * found and differs from the current `order`, we set `order` to it. Neighborhoods whose name
 * carries no number are left untouched.
 *
 * Idempotent — a second run finds every parseable row already correct and changes nothing.
 * Logs the count of rows updated / already-correct / skipped (no number).
 *
 * Usage:  npx dotenv -e .env -- tsx ops/backfill-neighborhood-order.ts
 */
import { prisma } from '@noc/db';

/** Normalize Arabic-Indic (٠-٩) and Persian (۰-۹) digits to ASCII, then pull the first integer. */
function parseNumber(name: string): number | null {
  const ascii = name.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
  const m = /(\d+)/.exec(ascii);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

async function main() {
  const stamp = () => new Date().toISOString();

  const neighborhoods = await prisma.neighborhood.findMany({ select: { id: true, nameAr: true, order: true } });

  let updated = 0;
  let unchanged = 0;
  let skipped = 0;
  for (const n of neighborhoods) {
    const parsed = parseNumber(n.nameAr ?? '');
    if (parsed === null) {
      skipped++;
      continue;
    }
    if (parsed === n.order) {
      unchanged++;
      continue;
    }
    await prisma.neighborhood.update({ where: { id: n.id }, data: { order: parsed } });
    updated++;
  }

  console.log(
    `[${stamp()}] backfill: neighborhood order set on ${updated} row(s)` +
      ` (${unchanged} already correct, ${skipped} with no number in the name — left unchanged;` +
      ` ${neighborhoods.length} total)`,
  );
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
