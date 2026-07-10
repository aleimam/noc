import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { prisma } from '@noc/db';
import { LanguageSwitcher, ThemeToggle } from '@noc/ui';
import { getStorefront } from '../../lib/storefront';
import { getAdminViewer } from '../../lib/adminView';
import { SearchBox } from './SearchBox';
import { CompareBar } from './CompareBar';
import { StoreMobileMenu } from './StoreMobileMenu';

const SOCIAL_ICON: Record<string, string> = {
  facebook: '📘',
  instagram: '📷',
  whatsapp: '💬',
  youtube: '▶️',
  tiktok: '🎵',
  telegram: '✈️',
  twitter: '𝕏',
  x: '𝕏',
  phone: '📞',
  email: '✉️',
};

export async function StoreShell({ children }: { children: React.ReactNode }) {
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const [content, footerPages, copyrightRows] = await Promise.all([
    getStorefront(),
    prisma.page.findMany({
      where: { brand: 'alsawarey', published: true },
      orderBy: { footerOrder: 'asc' },
      select: { slug: true, titleAr: true, titleEn: true },
    }),
    prisma.setting.findMany({ where: { key: { in: ['copyright_alsawarey', 'copyright_alsawarey_en'] } } }),
  ]);
  const Lc = (t: { ar: string; en: string }) => (locale === 'ar' ? t.ar : t.en);
  const whatsapp = content.contact.whatsapp;
  const socials = (content.contact.socials ?? []).filter((s) => s.url.trim());
  const cw = Object.fromEntries(copyrightRows.map((r) => [r.key, r.value]));
  const copyright =
    (locale === 'en' ? cw['copyright_alsawarey_en'] || cw['copyright_alsawarey'] : cw['copyright_alsawarey']) ||
    (locale === 'en' ? '© Al Sawarey Real-estate Investment' : `© ${new Date().getFullYear()} alsawarey.com`);
  const adminView = await getAdminViewer();

  return (
    <div className="min-h-screen bg-soft text-navy-800 dark:bg-navy-900 dark:text-soft">
      {adminView && (
        <div className="flex items-center justify-center gap-3 bg-amber-400 px-4 py-1.5 text-center text-sm font-bold text-navy-900">
          <span>🔒 {L('وضع المشرف — تظهر بيانات الملاك', 'Staff admin view — owner details visible')}</span>
          <a href="/admin-leave" className="rounded-md bg-navy-900/85 px-3 py-1 text-xs font-bold text-white hover:bg-navy-900">{L('مغادرة', 'Leave')}</a>
        </div>
      )}
      <header className="sticky top-0 z-40 bg-navy-800 text-white shadow-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <StoreMobileMenu
            brand={L('الصواري', 'Al Sawarey')}
            allLands={{ label: Lc(content.nav.allLands.label), href: content.nav.allLands.href }}
            featured={{ label: Lc(content.nav.featured.label), href: content.nav.featured.href }}
            sell={{ label: Lc(content.nav.sell.label), href: content.nav.sell.href }}
            groups={content.nav.groups.map((g) => ({ title: Lc(g.title), links: g.links.map((l) => ({ label: Lc(l.label), href: l.href })) }))}
            account={{ label: L('حسابي', 'Account'), href: '/account' }}
            wishlist={{ label: L('المفضلة', 'Wishlist'), href: '/wishlist' }}
          />
          <Link href="/" aria-label="Al Sawarey" className="flex-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo" alt="الصواري للاستثمار العقاري" className="h-10 w-auto" />
          </Link>

          <nav className="hidden flex-1 items-center gap-1 md:flex">
            <Link href={content.nav.allLands.href} className="rounded-lg px-3 py-2 text-sm hover:bg-white/10">{Lc(content.nav.allLands.label)}</Link>
            <Link href={content.nav.featured.href} className="rounded-lg px-3 py-2 text-sm font-bold text-gold hover:bg-white/10">★ {Lc(content.nav.featured.label)}</Link>
            {content.nav.groups.map((group, gi) => (
              <div key={gi} className="group relative">
                <button className="rounded-lg px-3 py-2 text-sm hover:bg-white/10">{Lc(group.title)} ▾</button>
                <div className="invisible absolute start-0 top-full z-50 min-w-44 rounded-xl bg-white p-2 text-navy-800 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 dark:bg-navy-800 dark:text-soft">
                  {group.links.map((link, li) => (
                    <Link key={li} href={link.href} className="block rounded-lg px-3 py-1.5 text-sm hover:bg-navy-50">{Lc(link.label)}</Link>
                  ))}
                </div>
              </div>
            ))}
            <Link href={content.nav.sell.href} className="rounded-lg px-3 py-2 text-sm font-bold text-gold hover:bg-white/10">{Lc(content.nav.sell.label)}</Link>
          </nav>

          <div className="ms-auto flex items-center gap-2">
            <SearchBox placeholder={L('ابحث عن أرض…', 'Search lands…')} />
            <div className="hidden items-center gap-2 md:flex">
              <Link href="/wishlist" aria-label={L('المفضلة', 'Wishlist')} className="rounded-lg px-2 py-1.5 text-lg hover:bg-white/10">♥</Link>
              <Link href="/account" className="rounded-lg border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10">{L('حسابي', 'Account')}</Link>
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {children}

      <CompareBar labels={{ compare: L('قارن', 'Compare'), clear: L('مسح', 'Clear'), items: L('عناصر للمقارنة', 'to compare') }} />

      <footer className="mt-10 bg-navy-900 text-white/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 py-4 text-center text-sm">
          <span className="font-bold text-white">{Lc(content.footer.brandLine)}</span>
          {footerPages.map((p) => (
            <Link key={p.slug} href={`/p/${p.slug}`} className="text-white/70 hover:text-gold">{locale === 'en' ? p.titleEn || p.titleAr : p.titleAr}</Link>
          ))}
          <Link href="/partner/login" className="text-white/70 hover:text-gold">{L('الشركاء', 'Partners')}</Link>
          <a href={`https://wa.me/${whatsapp.replace(/[^\d]/g, '')}`} className="text-gold" dir="ltr">{whatsapp}</a>
          {socials.map((s) => (
            <a key={s.platform + s.url} href={s.url} target="_blank" rel="noopener noreferrer" aria-label={s.platform}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-gold hover:text-navy-900">
              {SOCIAL_ICON[s.platform] ?? '🔗'}
            </a>
          ))}
        </div>
        <div className="border-t border-white/10 py-2 text-center text-xs text-white/50">{copyright}</div>
      </footer>
    </div>
  );
}
