// One-time F2 backfill: run every stored rich-HTML column through the same allow-list
// sanitiser the app now applies on save (apps/portal/lib/sanitize.ts), so rows written
// BEFORE the fix are cleaned too. Idempotent — safe to run repeatedly; only rows whose
// sanitised form differs are updated. Run once on prod after deploying the 3a batch:
//   npm run db:sanitize:backfill
//
// KEEP `OPTS` IN SYNC with apps/portal/lib/sanitize.ts (there is no shared import because
// that file is app-local TypeScript and this is a plain node script).
import { PrismaClient } from '@prisma/client';
import sanitizeHtml from 'sanitize-html';

const prisma = new PrismaClient();

const OPTS = {
  allowedTags: [
    'p', 'br', 'hr', 'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'span',
    'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'caption',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'title'],
    span: ['style'],
    td: ['colspan', 'rowspan', 'style'],
    th: ['colspan', 'rowspan', 'style'],
    '*': ['dir'],
  },
  allowedStyles: {
    '*': {
      color: [/^#(?:[0-9a-fA-F]{3}){1,2}$/, /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/],
      'text-align': [/^(?:left|right|center|justify)$/],
      'font-size': [/^\d{1,3}(?:px|em|rem|%)$/],
      'font-weight': [/^(?:bold|normal|\d{3})$/],
    },
  },
  allowedSchemes: ['http', 'https', 'tel', 'mailto'],
  allowProtocolRelative: false,
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow', target: '_blank' }),
  },
};

const clean = (html) => (html ? sanitizeHtml(html, OPTS) : html); // preserve null/'' as-is

// [label, model delegate, [html field names]]
const TARGETS = [
  ['Listing', prisma.listing, ['description']],
  ['Page', prisma.page, ['bodyAr', 'bodyEn']],
  ['News', prisma.news, ['bodyAr', 'bodyEn']],
  ['GuideEntry', prisma.guideEntry, ['bodyAr', 'bodyEn']],
  ['BuildingCondition', prisma.buildingCondition, ['bodyAr', 'bodyEn']],
  ['GeoUpdate', prisma.geoUpdate, ['body']],
];

async function backfill(name, delegate, fields) {
  const rows = await delegate.findMany({ select: { id: true, ...Object.fromEntries(fields.map((f) => [f, true])) } });
  let changed = 0;
  for (const row of rows) {
    const data = {};
    for (const f of fields) {
      const before = row[f];
      if (before == null) continue; // leave NULLs alone
      const after = clean(before);
      if (after !== before) data[f] = after;
    }
    if (Object.keys(data).length) {
      await delegate.update({ where: { id: row.id }, data });
      changed++;
    }
  }
  console.log(`  ${name}: ${changed}/${rows.length} row(s) sanitised`);
  return changed;
}

async function main() {
  console.log('F2 backfill — sanitising stored rich HTML…');
  let total = 0;
  for (const [name, delegate, fields] of TARGETS) total += await backfill(name, delegate, fields);
  console.log(`Done. ${total} row(s) updated.`);
}

main()
  .catch((e) => {
    console.error('sanitize-backfill failed', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
