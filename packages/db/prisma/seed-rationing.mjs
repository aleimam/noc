// Seed sample rationing-sheet rows (Module 1) so search/import can be tested.
// Idempotent: a fixed seed batch is wiped and recreated on every run.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BATCH_ID = 'seed_rationing_batch';

async function main() {
  const staff = await prisma.user.findFirst({ where: { type: 'STAFF' }, select: { id: true } });

  await prisma.rationingSheet.deleteMany({ where: { batchId: BATCH_ID } });
  await prisma.sheetImportBatch.upsert({
    where: { id: BATCH_ID },
    update: { rowCount: 0, fileName: 'seed-sample.xlsx', note: 'Seed sample data' },
    create: { id: BATCH_ID, fileName: 'seed-sample.xlsx', note: 'Seed sample data', uploadedById: staff?.id ?? null },
  });

  const rows = [
    { numberInSheet: '1', ownerName: 'محمد أحمد عبد الله', company: 'جمعية الأمل', originalPiece: '125', originalLocation: 'القادسية', originalMember: '457', sheetDate: new Date('2018-03-12'), paymentDate: new Date('2019-06-01'), sheetNotes: 'سداد كامل' },
    { numberInSheet: '2', ownerName: 'فاطمة محمود حسن', company: 'جمعية القادسية', originalPiece: '88', originalLocation: 'القادسية', originalMember: '120', sheetDate: new Date('2018-03-12'), paymentDate: new Date('2019-07-15') },
    { numberInSheet: '3', ownerName: 'أحمد سيد إبراهيم', company: 'جمعية الطلائع', originalPiece: '342', originalLocation: 'الطلائع', originalMember: '901', sheetDate: new Date('2017-11-20'), sheetNotes: 'متأخر سداد قسط' },
    { numberInSheet: '4', ownerName: 'منى علي عبد الرحمن', company: 'جمعية الأمل', originalPiece: '17', originalLocation: 'الأمل', originalMember: '76', sheetDate: new Date('2019-01-05'), paymentDate: new Date('2020-02-10') },
    { numberInSheet: '5', ownerName: 'خالد فتحي محمد', company: 'جمعية القادسية', originalPiece: '210', originalLocation: 'القادسية', originalMember: '334', sheetDate: new Date('2018-09-30') },
    { numberInSheet: '6', ownerName: 'سارة جمال الدين', company: 'جمعية الطلائع', originalPiece: '5', originalLocation: 'الطلائع', originalMember: '12', sheetDate: new Date('2020-05-18'), paymentDate: new Date('2021-01-22') },
    { numberInSheet: '7', ownerName: 'إبراهيم عبد الفتاح', company: 'جمعية الأمل', originalPiece: '430', originalLocation: 'الأمل', originalMember: '688', sheetDate: new Date('2017-06-11'), sheetNotes: 'تحويل ملكية' },
    { numberInSheet: '8', ownerName: 'نهى مصطفى كامل', company: 'جمعية القادسية', originalPiece: '99', originalLocation: 'القادسية', originalMember: '201', sheetDate: new Date('2019-12-01'), paymentDate: new Date('2020-12-01') },
    { numberInSheet: '9', ownerName: 'عمر حسن طه', company: 'جمعية الطلائع', originalPiece: '256', originalLocation: 'الطلائع', originalMember: '540', sheetDate: new Date('2018-02-14') },
    { numberInSheet: '10', ownerName: 'ياسمين سعيد فؤاد', company: 'جمعية الأمل', originalPiece: '63', originalLocation: 'الأمل', originalMember: '155', sheetDate: new Date('2021-03-09'), paymentDate: new Date('2022-03-09'), sheetNotes: 'سداد كامل' },
  ];

  for (const r of rows) {
    await prisma.rationingSheet.create({ data: { ...r, batchId: BATCH_ID, uploadedById: staff?.id ?? null } });
  }
  await prisma.sheetImportBatch.update({ where: { id: BATCH_ID }, data: { rowCount: rows.length } });
  console.log(`✓ Seeded ${rows.length} rationing sheets in batch ${BATCH_ID}.`);
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
