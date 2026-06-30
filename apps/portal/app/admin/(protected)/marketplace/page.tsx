import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { ContactSettings } from './ContactSettings';

export default async function MarketplaceHub() {
  await requirePermission('marketplace', 'VIEW');
  const t = await getTranslations('mp');
  const [classifiers, sections, attributes, owners, pending, offers, settings] = await Promise.all([
    prisma.classifier.count(),
    prisma.attributeSection.count(),
    prisma.attribute.count(),
    prisma.owner.count(),
    prisma.listing.count({ where: { status: 'PENDING' } }),
    prisma.landOffer.count({ where: { status: { in: ['NEW', 'REVIEWING'] } } }),
    prisma.setting.findMany({ where: { key: { in: ['alswarey_phone', 'alswarey_whatsapp'] } } }),
  ]);
  const sett = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  const cards = [
    // store management
    { href: '/admin/marketplace/listings', label: t('moderation'), count: pending },
    { href: '/admin/marketplace/offers', label: t('offers'), count: offers },
    { href: '/admin/marketplace/owners', label: t('owners'), count: owners },
    { href: '/admin/marketplace/wishlists', label: 'قوائم المفضلة', count: null },
    { href: '/admin/marketplace/storefront', label: 'واجهة موقع الصواري', count: null },
    { href: '/admin/marketplace/sell-content', label: t('sellContent'), count: null },
    { href: '/admin/settings/watermark', label: 'العلامة المائية للصور', count: null },
    // product catalog (shared taxonomy)
    { href: '/admin/marketplace/classifiers', label: t('classifiers'), count: classifiers },
    { href: '/admin/marketplace/sections', label: t('sections'), count: sections },
    { href: '/admin/marketplace/attributes', label: t('attributes'), count: attributes },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">إدارة موقع الصواري</h1>
        <p className="text-sm opacity-70">كل ما يخص متجر الصواري: العروض، الملاك، واجهة الموقع، ومحتواه.</p>
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
