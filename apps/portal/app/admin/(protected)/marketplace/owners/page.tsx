import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { OwnersManager } from './OwnersManager';

export default async function OwnersPage() {
  await requirePermission('marketplace', 'VIEW');
  const t = await getTranslations('mp');
  const owners = await prisma.owner.findMany({ orderBy: { name: 'asc' } });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('owners')}</h1>
        <a href="/admin/marketplace" className="text-sm text-accent">← {t('title')}</a>
      </div>
      <OwnersManager
        initial={owners.map((o) => ({
          id: o.id,
          name: o.name,
          type: o.type,
          ownerNo: o.ownerNo,
          phone1: o.phone1,
          phone1Whatsapp: o.phone1Whatsapp,
          phone2: o.phone2,
          phone2Whatsapp: o.phone2Whatsapp,
          details: o.details,
        }))}
      />
    </div>
  );
}
