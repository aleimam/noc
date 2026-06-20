// Seed Module 2 geography: New Obour districts + a few sample neighborhoods.
// Idempotent: districts upsert by key; sample neighborhoods upsert by fixed id.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DISTRICTS = [
  { key: 'first', nameAr: 'الحي الأول', nameEn: 'First District' },
  { key: 'second', nameAr: 'الحي الثاني', nameEn: 'Second District' },
  { key: 'third', nameAr: 'الحي الثالث', nameEn: 'Third District' },
  { key: 'fourth', nameAr: 'الحي الرابع', nameEn: 'Fourth District' },
  { key: 'fifth', nameAr: 'الحي الخامس', nameEn: 'Fifth District' },
  { key: 'sixth', nameAr: 'الحي السادس', nameEn: 'Sixth District' },
  { key: 'seventh', nameAr: 'الحي السابع', nameEn: 'Seventh District' },
  { key: 'eighth', nameAr: 'الحي الثامن', nameEn: 'Eighth District' },
  { key: 'ninth', nameAr: 'الحي التاسع', nameEn: 'Ninth District' },
  { key: 'tenth', nameAr: 'الحي العاشر', nameEn: 'Tenth District' },
  { key: 'craftsmen', nameAr: 'حي الحرفيين', nameEn: 'Craftsmen District' },
  { key: 'industrial', nameAr: 'المنطقة الصناعية', nameEn: 'Industrial Zone' },
  { key: 'services', nameAr: 'منطقة الخدمات', nameEn: 'Services Area' },
];

async function main() {
  const byKey = {};
  for (let i = 0; i < DISTRICTS.length; i++) {
    const d = DISTRICTS[i];
    const row = await prisma.district.upsert({
      where: { key: d.key },
      update: { nameAr: d.nameAr, nameEn: d.nameEn, order: i },
      create: { key: d.key, nameAr: d.nameAr, nameEn: d.nameEn, order: i },
    });
    byKey[d.key] = row.id;
  }

  // A few sample neighborhoods with the doc's metadata.
  const NEIGHBORHOODS = [
    { id: 'seed_nb_tenth_1', district: 'tenth', nameAr: 'مجاورة 1', nameEn: 'Block 1', hasBlocks: true, areas: [276, 350, 400], buildingTypes: ['home', 'villa'], mainRoads: ['R2', 'R3'], order: 0 },
    { id: 'seed_nb_tenth_2', district: 'tenth', nameAr: 'مجاورة 2', nameEn: 'Block 2', hasBlocks: false, assortedAreas: true, buildingTypes: ['home', 'building', 'villa'], mainRoads: ['R3', 'ring'], order: 1 },
    { id: 'seed_nb_first_1', district: 'first', nameAr: 'مجاورة 1', nameEn: 'Block 1', hasBlocks: false, areas: [209, 276], buildingTypes: ['building'], mainRoads: ['ismailia'], order: 0 },
    { id: 'seed_nb_industrial_1', district: 'industrial', nameAr: 'القطاع أ', nameEn: 'Sector A', hasBlocks: true, assortedAreas: true, buildingTypes: ['building'], mainRoads: ['belbees', 'ring'], order: 0 },
  ];
  for (const n of NEIGHBORHOODS) {
    const data = {
      districtId: byKey[n.district],
      nameAr: n.nameAr,
      nameEn: n.nameEn,
      hasBlocks: n.hasBlocks ?? false,
      assortedAreas: n.assortedAreas ?? false,
      areas: n.areas ?? [],
      buildingTypes: n.buildingTypes ?? [],
      mainRoads: n.mainRoads ?? [],
      order: n.order ?? 0,
    };
    await prisma.neighborhood.upsert({ where: { id: n.id }, update: data, create: { id: n.id, ...data } });
  }

  console.log(`✓ Seeded ${DISTRICTS.length} districts and ${NEIGHBORHOODS.length} sample neighborhoods.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
