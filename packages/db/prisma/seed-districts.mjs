// Seed New Obour's 40 districts (الحي الأول … الحي الأربعون). Idempotent: upsert by the
// `key` ordinal word, matching the existing rows (first … eleventh). Existing rows keep
// their names (only order/active are refreshed); 12–40 are created.
import { prisma } from './db-client.mjs';


const EN = [
  'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
  'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth', 'twentieth',
  'twenty-first', 'twenty-second', 'twenty-third', 'twenty-fourth', 'twenty-fifth', 'twenty-sixth', 'twenty-seventh', 'twenty-eighth', 'twenty-ninth', 'thirtieth',
  'thirty-first', 'thirty-second', 'thirty-third', 'thirty-fourth', 'thirty-fifth', 'thirty-sixth', 'thirty-seventh', 'thirty-eighth', 'thirty-ninth', 'fortieth',
];

const AR = [
  'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر',
  'الحادي عشر', 'الثاني عشر', 'الثالث عشر', 'الرابع عشر', 'الخامس عشر', 'السادس عشر', 'السابع عشر', 'الثامن عشر', 'التاسع عشر', 'العشرون',
  'الحادي والعشرون', 'الثاني والعشرون', 'الثالث والعشرون', 'الرابع والعشرون', 'الخامس والعشرون', 'السادس والعشرون', 'السابع والعشرون', 'الثامن والعشرون', 'التاسع والعشرون', 'الثلاثون',
  'الحادي والثلاثون', 'الثاني والثلاثون', 'الثالث والثلاثون', 'الرابع والثلاثون', 'الخامس والثلاثون', 'السادس والثلاثون', 'السابع والثلاثون', 'الثامن والثلاثون', 'التاسع والثلاثون', 'الأربعون',
];

const titleEn = (w) => w.split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('-');

async function main() {
  let created = 0;
  let updated = 0;
  for (let n = 1; n <= 40; n++) {
    const key = EN[n - 1];
    const nameEn = `${titleEn(key)} District`;
    const nameAr = `الحي ${AR[n - 1]}`;
    const existing = await prisma.district.findUnique({ where: { key } });
    if (existing) {
      await prisma.district.update({ where: { key }, data: { order: n - 1, isActive: true } });
      updated++;
    } else {
      await prisma.district.create({ data: { key, nameAr, nameEn, order: n - 1, isActive: true } });
      created++;
    }
  }
  console.log(`✓ Districts 1–40: ${created} created, ${updated} updated.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    return prisma.$disconnect().finally(() => process.exit(1));
  });
