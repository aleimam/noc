import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { ContactSettings } from './ContactSettings';
import { RegenAllButton } from './RegenAllButton';

export const dynamic = 'force-dynamic';

export default async function MarketplaceHub() {
  await requirePermission('storefront', 'VIEW');
  const t = await getTranslations('mp');
  const locale = await getLocale();
  const L = (ar: string, en: string) => (locale === 'en' ? en : ar);

  const [classifiers, sections, attributes, optionLists, owners, pendingListings, offers, settings, typeOpts] = await Promise.all([
    prisma.classifier.count(),
    prisma.attributeSection.count(),
    prisma.attribute.count(),
    prisma.optionList.count(),
    prisma.owner.count(),
    prisma.listing.count({ where: { status: 'PENDING', deletedAt: null } }),
    prisma.landOffer.count({ where: { status: { in: ['NEW', 'REVIEWING'] } } }),
    prisma.setting.findMany({ where: { key: { in: ['alswarey_phone', 'alswarey_whatsapp'] } } }),
    prisma.classifierOption.findMany({
      where: { isActive: true, classifier: { key: 'type' } },
      orderBy: { order: 'asc' },
      select: { id: true, nameAr: true, nameEn: true },
    }),
  ]);
  const sett = Object.fromEntries(settings.map((s) => [s.key, s.value]));

  type Card = { href: string; label: string; count?: number; alert?: boolean };
  const ops: Card[] = [
    { href: '/admin/marketplace/listings', label: L('الأراضي والعروض', 'Lands & listings'), count: pendingListings, alert: pendingListings > 0 },
    { href: '/admin/marketplace/offers', label: L('عروض البيع الواردة', 'Incoming offers'), count: offers, alert: offers > 0 },
    { href: '/admin/marketplace/owners', label: L('الملاك', 'Owners'), count: owners },
    { href: '/admin/marketplace/wishlists', label: L('قوائم المفضلة', 'Wishlists') },
  ];
  const setup: Card[] = [
    { href: '/admin/marketplace/storefront', label: L('واجهة المتجر', 'Storefront') },
    { href: '/admin/marketplace/sell-content', label: L('محتوى صفحة البيع', 'Sell-page content') },
    { href: '/admin/marketplace/classifiers', label: L('التصنيفات', 'Classifiers'), count: classifiers },
    { href: '/admin/marketplace/attributes', label: L('التفاصيل', 'Details'), count: attributes },
    { href: '/admin/marketplace/sections', label: L('مجموعات التفاصيل', 'Detail groups'), count: sections },
    { href: '/admin/marketplace/option-lists', label: L('قوائم الاختيارات', 'Option lists'), count: optionLists },
  ];

  const Grid = ({ title, cards }: { title: string; cards: Card[] }) => (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <a key={c.href} href={c.href} className="flex items-center justify-between rounded-lg border border-graphite/15 p-5 transition-colors hover:border-accent">
            <span className="text-sm font-medium opacity-90">{c.label}</span>
            {typeof c.count === 'number' && (
              <span className={`rounded-full px-2.5 py-1 text-sm font-bold ${c.alert ? 'bg-amber-100 text-amber-800' : 'bg-graphite/10 text-primary'}`}>{c.count}</span>
            )}
          </a>
        ))}
      </div>
    </section>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary">{L('إدارة متجر الصواري', 'Al Sawarey store')}</h1>
          <p className="text-sm opacity-70">{L('العروض والملاك، وإعداد واجهة المتجر وتصنيفاته.', 'Listings & owners, plus storefront design and taxonomy.')}</p>
        </div>
        <RegenAllButton locale={locale as 'ar' | 'en'} types={typeOpts} />
      </div>
      <Grid title={L('العمليات', 'Operations')} cards={ops} />
      <Grid title={L('الإعداد', 'Setup')} cards={setup} />
      <ContactSettings phone={sett.alswarey_phone ?? ''} whatsapp={sett.alswarey_whatsapp ?? ''} />
    </div>
  );
}
