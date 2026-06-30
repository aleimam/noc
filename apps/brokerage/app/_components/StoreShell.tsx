import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { LanguageSwitcher } from '@noc/ui';
import { MENU, WHATSAPP } from '../../lib/store';
import { SearchBox } from './SearchBox';

export async function StoreShell({ children }: { children: React.ReactNode }) {
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  return (
    <div className="min-h-screen bg-soft">
      <header className="sticky top-0 z-40 bg-navy-800 text-white shadow-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <Link href="/" aria-label="ALSWARY" className="flex-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="الصواري للاستثمار العقاري" className="h-10 w-auto" />
          </Link>

          <nav className="hidden flex-1 items-center gap-1 md:flex">
            <Link href="/listings" className="rounded-lg px-3 py-2 text-sm hover:bg-white/10">{L('كل الأراضي', 'All lands')}</Link>
            {MENU.map((group) => (
              <div key={group.titleEn} className="group relative">
                <button className="rounded-lg px-3 py-2 text-sm hover:bg-white/10">{L(group.titleAr, group.titleEn)} ▾</button>
                <div className="invisible absolute start-0 top-full z-50 min-w-44 rounded-xl bg-white p-2 text-navy-800 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100">
                  {group.links.map((link) => (
                    <Link key={link.href} href={link.href} className="block rounded-lg px-3 py-1.5 text-sm hover:bg-navy-50">{L(link.labelAr, link.labelEn)}</Link>
                  ))}
                </div>
              </div>
            ))}
            <Link href="/sell" className="rounded-lg px-3 py-2 text-sm font-bold text-gold hover:bg-white/10">{L('بيع أرضك', 'Sell your land')}</Link>
          </nav>

          <div className="ms-auto flex items-center gap-2">
            <SearchBox placeholder={L('ابحث عن أرض…', 'Search lands…')} />
            <Link href="/account" className="rounded-lg border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10">{L('حسابي', 'Account')}</Link>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      {children}

      <footer className="mt-12 bg-navy-900 text-white/80">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-8 text-center text-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-10 w-auto" />
          <p>{L('الصواري للاستثمار العقاري', 'ALSWARY Real-estate Investment')}</p>
          <a href={`https://wa.me/${WHATSAPP.replace(/[^\d]/g, '')}`} className="text-gold" dir="ltr">{WHATSAPP}</a>
          <p className="text-white/50">© {new Date().getFullYear()} alsawarey.com</p>
        </div>
      </footer>
    </div>
  );
}
