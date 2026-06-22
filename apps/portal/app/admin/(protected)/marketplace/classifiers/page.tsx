import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';

export default async function ClassifiersPage() {
  await requirePermission('marketplace', 'VIEW');
  const t = await getTranslations('mp');
  const classifiers = await prisma.classifier.findMany({
    orderBy: { order: 'asc' },
    include: { _count: { select: { options: true } } },
  });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('classifiers')}</h1>
        <a href="/admin/marketplace" className="text-sm text-accent">← {t('title')}</a>
      </div>
      <p className="text-sm opacity-70">{t('classifiersHint')}</p>
      <div className="grid gap-4 sm:grid-cols-3">
        {classifiers.map((c) => (
          <a key={c.id} href={`/admin/marketplace/classifiers/${c.id}`} className="rounded-lg border border-graphite/15 p-5 transition-colors hover:border-accent">
            <div className="text-lg font-bold text-primary">{c.nameAr} / {c.nameEn}</div>
            <div className="mt-1 text-sm opacity-70">{c._count.options} {t('optionCount')}</div>
          </a>
        ))}
      </div>
    </div>
  );
}
