import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { PublicShell, FloatingWhatsApp } from '@noc/ui';
import { auth } from '@noc/auth';
import { prisma } from '@noc/db';
import { getModuleVisibility, MODULE_KEYS, type ModuleKey } from '../../lib/modules';
import { getSiteConfig } from '../../lib/site';

// Public chrome that also enforces module visibility: if the active module is turned
// off in the backend, the page 404s; disabled modules are hidden from the nav.
export async function SiteShell({ active, children }: { active?: string; children: ReactNode }) {
  const locale = (await getLocale()) as 'ar' | 'en';
  const [vis, pages, site, session] = await Promise.all([
    getModuleVisibility(),
    prisma.page.findMany({
      where: { brand: 'newobour', published: true },
      orderBy: { footerOrder: 'asc' },
      select: { slug: true, titleAr: true, titleEn: true },
    }),
    getSiteConfig(),
    auth(),
  ]);
  if (active && (MODULE_KEYS as readonly string[]).includes(active) && vis[active as ModuleKey] === false) notFound();
  const hidden = MODULE_KEYS.filter((k) => vis[k] === false);
  const footerPages = pages.map((p) => ({ href: `/p/${p.slug}`, label: locale === 'en' ? p.titleEn || p.titleAr : p.titleAr }));
  // Customers AND partners get an account button; partners point at their portal. Partners
  // browse the full site like customers, with extra powers in their own section.
  const type = session?.user?.type;
  const isPartner = type === 'PARTNER';
  const loggedIn = type === 'CUSTOMER' || isPartner;
  const accountHref = isPartner ? '/partner' : '/account';
  const accountLabel = isPartner ? (locale === 'en' ? 'Partner portal' : 'بوابة الشركاء') : locale === 'en' ? 'My account' : 'حسابي';
  const partners = { href: '/partner/join', label: locale === 'en' ? 'Partners' : 'الشركاء' };
  return (
    <PublicShell active={active} hiddenKeys={hidden} footerPages={footerPages} copyright={locale === 'en' ? site.copyrightEn : site.copyright} tagline={locale === 'en' ? site.sloganEn : site.slogan} mobileMenuMode={site.mobileMenuMode} loggedIn={loggedIn} accountLabel={accountLabel} accountHref={accountHref} partners={partners}>
      {children}
      {site.whatsappFloat && site.whatsappHelp && (
        <FloatingWhatsApp
          phone={site.whatsappHelp}
          message={site.whatsappFloatMsg || (locale === 'en' ? 'Hello, I have a question' : 'مرحباً، لدي استفسار')}
          label={locale === 'en' ? 'Contact us on WhatsApp' : 'تواصل معنا على واتساب'}
        />
      )}
    </PublicShell>
  );
}
