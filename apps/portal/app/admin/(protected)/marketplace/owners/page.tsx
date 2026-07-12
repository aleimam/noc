import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { OwnersManager } from './OwnersManager';
import { PartnerBrowseGlobalToggle } from './PartnerBrowseGlobalToggle';

export default async function OwnersPage() {
  await requirePermission('owners', 'VIEW');
  const t = await getTranslations('mp');
  const locale = (await getLocale()) as 'ar' | 'en';
  const owners = await prisma.owner.findMany({
    orderBy: { name: 'asc' },
    include: { codes: { select: { code: true }, orderBy: { code: 'asc' } } },
  });
  // All codes already taken (by any owner) — the picker greys these out for other owners.
  const takenCodes = (await prisma.ownerCode.findMany({ select: { code: true } })).map((c) => c.code);
  const browseGlobal = (await prisma.setting.findUnique({ where: { key: 'partner.browseListings' }, select: { value: true } }))?.value === 'true';
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('owners')}</h1>
        <div className="flex items-center gap-3">
          <a href="/admin/marketplace/owners/personal" className="text-sm text-accent">{t('personalOwners')}</a>
          <a href="/admin/marketplace" className="text-sm text-accent">← {t('title')}</a>
        </div>
      </div>
      <PartnerBrowseGlobalToggle initial={browseGlobal} locale={locale} />
      <OwnersManager
        takenCodes={takenCodes}
        initial={owners.map((o) => ({
          id: o.id,
          name: o.name,
          type: o.type,
          codes: o.codes.map((c) => c.code),
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
