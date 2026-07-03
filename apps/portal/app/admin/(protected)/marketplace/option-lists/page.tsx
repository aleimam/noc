import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { OptionListsManager } from './OptionListsManager';

export const dynamic = 'force-dynamic';

export default async function OptionListsPage() {
  await requirePermission('marketplace', 'VIEW');
  const t = await getTranslations('mp');
  const lists = await prisma.optionList.findMany({
    orderBy: { name: 'asc' },
    include: {
      items: { orderBy: { order: 'asc' }, select: { id: true, key: true, labelAr: true, labelEn: true, isActive: true } },
      _count: { select: { attributes: true } },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('optionLists')}</h1>
        <a href="/admin/marketplace/attributes" className="text-sm text-accent">← {t('attributes')}</a>
      </div>
      <p className="text-sm opacity-60">{t('optionListsHint')}</p>
      <OptionListsManager
        lists={lists.map((l) => ({ id: l.id, name: l.name, usedBy: l._count.attributes, items: l.items }))}
      />
    </div>
  );
}
