import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { prisma } from '@noc/db';
import { waPhone } from '@noc/config';
import { LanguageSwitcher, ThemeToggle, FloatingWhatsApp } from '@noc/ui';
import { getStorefront } from '../../lib/storefront';
import { getAdminViewer } from '../../lib/adminView';
import { SearchBox } from './SearchBox';
import { CompareBar } from './CompareBar';
import { StoreMobileMenu } from './StoreMobileMenu';

/* Real brand glyphs (inline SVG, currentColor) for the footer contact icons. */
function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.9h2.54V9.85c0-2.52 1.5-3.92 3.78-3.92 1.1 0 2.24.2 2.24.2v2.47H15.2c-1.25 0-1.64.78-1.64 1.57v1.89h2.78l-.44 2.9h-2.34V22c4.78-.76 8.44-4.92 8.44-9.94Z" />
    </svg>
  );
}
function WhatsAppIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12.04 2A9.9 9.9 0 0 0 2.1 11.9c0 1.75.46 3.45 1.34 4.96L2 22l5.3-1.39a9.96 9.96 0 0 0 4.74 1.2h.01a9.9 9.9 0 0 0 9.94-9.9A9.83 9.83 0 0 0 19.07 4.9 9.9 9.9 0 0 0 12.04 2Zm0 18.13h-.01a8.24 8.24 0 0 1-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38 8.23 8.23 0 0 1 8.26-8.2 8.2 8.2 0 0 1 5.83 2.42 8.15 8.15 0 0 1 2.41 5.8 8.23 8.23 0 0 1-8.24 8.22Zm4.52-6.15c-.25-.13-1.47-.72-1.69-.8-.23-.09-.4-.13-.56.12-.17.25-.64.8-.79.97-.14.16-.29.19-.53.06a6.7 6.7 0 0 1-1.98-1.22 7.4 7.4 0 0 1-1.37-1.7c-.14-.25-.02-.38.11-.5.11-.12.25-.3.37-.44.13-.15.17-.25.25-.42.08-.16.04-.31-.02-.44-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.42h-.47c-.17 0-.44.06-.66.31-.23.25-.87.85-.87 2.07 0 1.22.9 2.4 1.02 2.57.12.16 1.74 2.65 4.23 3.72.59.25 1.05.4 1.41.52.6.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.16-.48-.28Z" />
    </svg>
  );
}
function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.61 21 3 13.39 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.24.2 2.45.57 3.57a1 1 0 0 1-.24 1.02l-2.21 2.2Z" />
    </svg>
  );
}

const SOCIAL_EMOJI: Record<string, string> = {
  instagram: '📷',
  youtube: '▶️',
  tiktok: '🎵',
  telegram: '✈️',
  twitter: '𝕏',
  x: '𝕏',
  email: '✉️',
};

function SocialIcon({ platform }: { platform: string }) {
  if (platform === 'facebook') return <FacebookIcon />;
  if (platform === 'whatsapp') return <WhatsAppIcon />;
  if (platform === 'phone') return <PhoneIcon />;
  return <>{SOCIAL_EMOJI[platform] ?? '🔗'}</>;
}

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
    prisma.setting.findMany({ where: { key: { in: ['copyright_alsawarey', 'copyright_alsawarey_en', 'whatsapp_float_alsawarey', 'whatsapp_float_msg_alsawarey'] } } }),
  ]);
  const Lc = (t: { ar: string; en: string }) => (locale === 'ar' ? t.ar : t.en);
  const whatsapp = content.contact.whatsapp;
  const socials = (content.contact.socials ?? []).filter((s) => s.url.trim());
  const cw = Object.fromEntries(copyrightRows.map((r) => [r.key, r.value]));
  const whatsappFloat = cw['whatsapp_float_alsawarey'] === '1';
  const whatsappFloatMsg = cw['whatsapp_float_msg_alsawarey'] || '';
  // EN must NEVER fall back to the Arabic setting — an untranslated copyright line on the
  // English site reads as a bug. Missing EN setting → the built-in English default.
  const copyright =
    locale === 'en'
      ? cw['copyright_alsawarey_en'] || `© ${new Date().getFullYear()} Al Sawarey Real Estate Investment — all rights reserved`
      : cw['copyright_alsawarey'] || `© ${new Date().getFullYear()} alsawarey.com`;
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
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4">
          <StoreMobileMenu
            locale={locale}
            brand={L('الصواري', 'Al Sawarey')}
            allLands={{ label: Lc(content.nav.allLands.label), href: content.nav.allLands.href }}
            featured={{ label: Lc(content.nav.featured.label), href: content.nav.featured.href }}
            sell={{ label: Lc(content.nav.sell.label), href: content.nav.sell.href }}
            groups={content.nav.groups.map((g) => ({ title: Lc(g.title), links: g.links.map((l) => ({ label: Lc(l.label), href: l.href })) }))}
            account={{ label: L('حسابي', 'Account'), href: '/account' }}
            wishlist={{ label: L('المفضلة', 'Wishlist'), href: '/wishlist' }}
            partners={{ label: L('الشركاء', 'Partners'), href: '/partner/login' }}
          />
          <Link href="/" aria-label="Al Sawarey" className="flex-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo" alt="الصواري للاستثمار العقاري" className="h-10 w-auto" />
          </Link>

          {/* Desktop nav appears at lg (≥1024) only — below that the hamburger holds it, so
              the busy row never overflows at tablet widths. */}
          <nav className="hidden items-center gap-0.5 lg:flex">
            <Link href={content.nav.allLands.href} className="whitespace-nowrap rounded-lg px-2.5 py-2 text-sm hover:bg-white/10">{Lc(content.nav.allLands.label)}</Link>
            <Link href={content.nav.featured.href} className="whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-bold text-gold hover:bg-white/10">★ {Lc(content.nav.featured.label)}</Link>
            {content.nav.groups.map((group, gi) => (
              <div key={gi} className="group relative">
                <button className="whitespace-nowrap rounded-lg px-2.5 py-2 text-sm hover:bg-white/10">{Lc(group.title)} ▾</button>
                <div className="invisible absolute start-0 top-full z-50 min-w-44 rounded-xl bg-white p-2 text-navy-800 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 dark:bg-navy-800 dark:text-soft">
                  {group.links.map((link, li) => (
                    <Link key={li} href={link.href} className="block rounded-lg px-3 py-1.5 text-sm hover:bg-navy-50">{Lc(link.label)}</Link>
                  ))}
                </div>
              </div>
            ))}
            <Link href={content.nav.sell.href} className="whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-bold text-gold hover:bg-white/10">{Lc(content.nav.sell.label)}</Link>
            <Link href="/partner/login" className="whitespace-nowrap rounded-lg px-2.5 py-2 text-sm hover:bg-white/10">{L('الشركاء', 'Partners')}</Link>
          </nav>

          {/* Flexible spacer holding the search — grows to fill, shrinks first so the row
              stays one line at every width. */}
          <div className="flex min-w-0 flex-1 justify-end lg:justify-start">
            <SearchBox className="w-full max-w-[13rem]" placeholder={L('ابحث عن أرض…', 'Search lands…')} />
          </div>

          <div className="hidden flex-none items-center gap-2 lg:flex">
            <Link href="/wishlist" aria-label={L('المفضلة', 'Wishlist')} className="rounded-lg px-2 py-1.5 text-lg hover:bg-white/10">♥</Link>
            <Link href="/account" className="whitespace-nowrap rounded-lg border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10">{L('حسابي', 'Account')}</Link>
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {children}

      <CompareBar labels={{ compare: L('قارن', 'Compare'), clear: L('مسح', 'Clear'), items: L('عناصر للمقارنة', 'to compare') }} />

      {/* Footer — two-tier layout (owner choice 2026-07-21): brand + contact on top, all links
          in a labelled row below, then the copyright bar. */}
      <footer className="mt-10 bg-navy-900 text-white/80">
        <div className="mx-auto max-w-6xl px-4 py-5">
          {/* Tier 1: brand (start) ↔ contact (end). */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="font-bold text-white">{Lc(content.footer.name)}</div>
              {Lc(content.footer.slogan) && <div className="mt-0.5 text-sm text-white/70">{Lc(content.footer.slogan)}</div>}
            </div>
            <div className="flex items-center gap-3">
              {whatsapp && (
                <a href={`https://wa.me/${waPhone(whatsapp)}`} aria-label="WhatsApp" className="inline-flex min-h-10 items-center gap-1.5 text-gold" dir="ltr">
                  <WhatsAppIcon className="h-4 w-4" />
                  {whatsapp}
                </a>
              )}
              {socials.map((s) => (
                <a key={s.platform + s.url} href={s.url} target="_blank" rel="noopener noreferrer" aria-label={s.platform}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-gold hover:text-navy-900">
                  <SocialIcon platform={s.platform} />
                </a>
              ))}
            </div>
          </div>
          {/* Tier 2: useful official links (owner request 2026-07-16) + any CMS footer pages, one row. */}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/10 pt-4 text-sm">
            <span className="text-xs font-bold uppercase tracking-wide text-gold">{L('روابط مفيدة', 'Useful links')}</span>
            {[
              { href: 'https://newobour.com/', ar: 'بوابة العبور الجديدة', en: 'New Obour portal' },
              { href: 'https://nuca-services.gov.eg/#/home', ar: 'خدمات هيئة المجتمعات العمرانية', en: 'NUCA e-services' },
              { href: 'http://www.newcities.gov.eg/know_cities/NewObour/default.aspx', ar: 'مدينة العبور الجديدة — هيئة المجتمعات', en: 'New Obour — New Cities Authority' },
              { href: 'https://www.facebook.com/profile.php?id=100069065355149', ar: 'جهاز المدينة على فيسبوك', en: 'City authority on Facebook' },
              { href: 'https://www.newobour.city/', ar: 'newobour.city', en: 'newobour.city' },
            ].map((l) => (
              <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center text-white/70 hover:text-gold">
                {L(l.ar, l.en)}&nbsp;<span aria-hidden className="text-xs">↗</span>
              </a>
            ))}
            {footerPages.map((p) => (
              <Link key={p.slug} href={`/p/${p.slug}`} className="inline-flex min-h-10 items-center text-white/70 hover:text-gold">{locale === 'en' ? p.titleEn || p.titleAr : p.titleAr}</Link>
            ))}
          </div>
        </div>
        <div className="border-t border-white/10 py-2 text-center text-xs text-white/50">{copyright}</div>
      </footer>

      {whatsappFloat && whatsapp && (
        <FloatingWhatsApp
          phone={whatsapp}
          message={whatsappFloatMsg || L('مرحباً، لدي استفسار', 'Hello, I have a question')}
          label={L('تواصل معنا على واتساب', 'Contact us on WhatsApp')}
        />
      )}
    </div>
  );
}
