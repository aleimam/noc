/**
 * Make the listing "city" (المدينة) a MANDATORY basic detail on every listing, restricted to the
 * single city we operate in today (New Obour City). The mandatory-ness itself is enforced in both
 * listing forms via REQUIRED_LISTING_ATTR_KEYS (@noc/config); this script prepares the DB so the
 * field always shows, always has exactly one active choice, and old listings carry it too:
 *
 *   1. Ensure the `city` attribute is active.
 *   2. Link `city` to EVERY Type classifier option, so it is applicable to every listing category
 *      (an unlinked attribute is hidden everywhere — see the applicability rule in the forms).
 *   3. Restrict the choices to one active city: activate `new_obour`, deactivate the rest
 *      (old_obour / new_cairo / shorouk / badr). With one active choice the forms auto-select it,
 *      so a low-tech seller never has to touch a locked field.
 *   4. Backfill: every listing that has no city value yet gets New Obour. The value is written in
 *      the column that BOTH read paths understand (legacy AttributeOption → `optionId`, shared
 *      OptionList → `listItemId`), so it shows on the storefront cards and round-trips in the form.
 *
 * Idempotent — a second run finds everything already correct and changes nothing.
 *
 * Usage:  npx dotenv -e .env -- tsx ops/city-mandatory.ts
 */
import { prisma } from '@noc/db';

const PRIMARY_CITY_KEY = 'new_obour';

async function main() {
  const stamp = () => new Date().toISOString();

  const city = await prisma.attribute.findUnique({
    where: { key: 'city' },
    select: {
      id: true,
      isActive: true,
      optionListId: true,
      options: { select: { id: true, key: true, isActive: true } },
      optionList: { select: { items: { select: { id: true, key: true, isActive: true } } } },
    },
  });
  if (!city) {
    console.error(`[${stamp()}] city-mandatory: no attribute with key "city" found — nothing to do.`);
    return;
  }

  // 1) Ensure the attribute is active.
  if (!city.isActive) await prisma.attribute.update({ where: { id: city.id }, data: { isActive: true } });

  // 2) Link `city` to every Type classifier option (applicable to all listing categories).
  const typeCls = await prisma.classifier.findUnique({ where: { key: 'type' }, select: { options: { select: { id: true } } } });
  let ensuredLinks = 0;
  for (const o of typeCls?.options ?? []) {
    await prisma.attributeClassifier.upsert({
      where: { attributeId_optionId: { attributeId: city.id, optionId: o.id } },
      update: {},
      create: { attributeId: city.id, optionId: o.id },
    });
    ensuredLinks++;
  }

  // 3) Restrict to one active city (New Obour). Choices are either a shared OptionList or the
  //    legacy inline AttributeOptions — handle whichever this attribute uses.
  const usesList = !!city.optionListId;
  const choices = (usesList ? city.optionList?.items : city.options) ?? [];
  let primaryId: string | null = null;
  let activated = 0;
  let deactivated = 0;
  for (const c of choices) {
    const shouldBeActive = c.key === PRIMARY_CITY_KEY;
    if (shouldBeActive) primaryId = c.id;
    if (c.isActive === shouldBeActive) continue;
    if (usesList) await prisma.optionListItem.update({ where: { id: c.id }, data: { isActive: shouldBeActive } });
    else await prisma.attributeOption.update({ where: { id: c.id }, data: { isActive: shouldBeActive } });
    if (shouldBeActive) activated++;
    else deactivated++;
  }

  // 4) Backfill the city value on listings that don't have one yet.
  let backfilled = 0;
  if (primaryId) {
    const withCity = new Set(
      (await prisma.listingValue.findMany({ where: { attributeId: city.id }, select: { listingId: true } })).map((v) => v.listingId),
    );
    const listings = await prisma.listing.findMany({ select: { id: true } });
    const rows = listings
      .filter((l) => !withCity.has(l.id))
      .map((l) => (usesList ? { listingId: l.id, attributeId: city.id, listItemId: primaryId! } : { listingId: l.id, attributeId: city.id, optionId: primaryId! }));
    if (rows.length) {
      await prisma.listingValue.createMany({ data: rows });
      backfilled = rows.length;
    }
  }

  console.log(
    `[${stamp()}] city-mandatory: attribute active ✓ | type-links ensured=${ensuredLinks} | ` +
      `choices activated=${activated} deactivated=${deactivated} | primary(new_obour)=${primaryId ? '✓' : 'MISSING'} | ` +
      `listings backfilled=${backfilled}`,
  );
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
