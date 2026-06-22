import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { ContactSettings } from './ContactSettings';

export default async function MarketplaceHub() {
  await requirePermission('marketplace', 'VIEW');
  const t = await getTranslations('mp');
  const [classifiers, sections, attributes, owners, pending, settings] = await Promise.all([
    prisma.classifier.count(),
    prisma.attributeSection.count(),
    prisma.attribute.count(),
    prisma.owner.count(),
    prisma.listing.count({ where: { status: 'PENDING' } }),
    prisma.setting.findMany({ where: { key: { in: ['alswarey_phone', 'alswarey_whatsapp'] } } }),
  ]);
  const sett = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  const cards = [
    { href: '/admin/marketplace/classifiers', label: t('classifiers'), count: classifiers },
    { href: '/admin/marketplace/sections', label: t('sections'), count: sections },
    { href: '/admin/marketplace/attributes', label: t('attributes'), count: attributes },
    { href: '/admin/marketplace/owners', label: t('owners'), count: owners },
    { href: '/admin/marketplace/listings', label: t('moderation'), count: pending },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">{t('title')}</h1>
        <p className="text-sm opacity-70">{t('manage')}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <a key={c.href} href={c.href} className="rounded-lg border border-graphite/15 p-5 transition-colors hover:border-accent">
            <div className="text-3xl font-bold text-primary">{c.count}</div>
            <div className="mt-1 text-sm opacity-80">{c.label}</div>
          </a>
        ))}
      </div>
      <ContactSettings phone={sett.alswarey_phone ?? ''} whatsapp={sett.alswarey_whatsapp ?? ''} />
    </div>
  );
}
