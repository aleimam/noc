import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { PublicShell } from '@noc/ui';
import { prisma } from '@noc/db';
import { getModuleVisibility, MODULE_KEYS, type ModuleKey } from '../../lib/modules';
import { getSiteConfig } from '../../lib/site';

// Public chrome that also enforces module visibility: if the active module is turned
// off in the backend, the page 404s; disabled modules are hidden from the nav.
export async function SiteShell({ active, children }: { active?: string; children: ReactNode }) {
  const locale = (await getLocale()) as 'ar' | 'en';
  const [vis, pages, site] = await Promise.all([
    getModuleVisibility(),
    prisma.page.findMany({
      where: { brand: 'newobour', published: true },
      orderBy: { footerOrder: 'asc' },
      select: { slug: true, titleAr: true, titleEn: true },
    }),
    getSiteConfig(),
  ]);
  if (active && (MODULE_KEYS as readonly string[]).includes(active) && vis[active as ModuleKey] === false) notFound();
  const hidden = MODULE_KEYS.filter((k) => vis[k] === false);
  const footerPages = pages.map((p) => ({ href: `/p/${p.slug}`, label: locale === 'en' ? p.titleEn || p.titleAr : p.titleAr }));
  return (
    <PublicShell active={active} hiddenKeys={hidden} footerPages={footerPages} copyright={site.copyright} mobileMenuMode={site.mobileMenuMode}>
      {children}
    </PublicShell>
  );
}
