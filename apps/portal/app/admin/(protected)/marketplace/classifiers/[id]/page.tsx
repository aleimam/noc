import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { CatalogTable } from '../../CatalogTable';
import { upsertClassifierOption, deleteClassifierOption } from '../../actions';

export default async function ClassifierOptionsPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('marketplace', 'VIEW');
  const { id } = await params;
  const t = await getTranslations('mp');
  const classifier = await prisma.classifier.findUnique({
    where: { id },
    include: { options: { orderBy: { order: 'asc' } } },
  });
  if (!classifier) notFound();
  const data = classifier.options.map((o) => ({
    id: o.id,
    key: o.key,
    nameAr: o.nameAr,
    nameEn: o.nameEn,
    order: o.order,
    isActive: o.isActive,
  }));
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{classifier.nameAr} / {classifier.nameEn}</h1>
        <a href="/admin/marketplace/classifiers" className="text-sm text-accent">← {t('classifiers')}</a>
      </div>
      <CatalogTable
        initial={data}
        upsert={upsertClassifierOption.bind(null, classifier.id)}
        remove={deleteClassifierOption}
      />
    </div>
  );
}
