import type { Metadata } from 'next';
import { Tajawal, Playfair_Display, Cairo, Almarai } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { dirForLocale, type Locale } from '@noc/i18n';
import { ThemeScript, Analytics, ConsentBanner, EnterToSubmit, Tracker, Toaster } from '@noc/ui';
import { buildThemeCss, parseSocialLinks, SOCIAL_SETTING_KEYS } from '@noc/config';
import { prisma } from '@noc/db';
import { getBrandTheme } from '../lib/theme';
import './globals.css';

const tajawal = Tajawal({ subsets: ['arabic', 'latin'], weight: ['300', '400', '500', '700', '800', '900'], variable: '--font-tajawal', display: 'swap' });
const playfair = Playfair_Display({ subsets: ['latin'], weight: ['400', '600', '700'], variable: '--font-playfair', display: 'swap' });
// Optional theme fonts (loaded only when an admin selects them — preload off keeps them lazy).
const cairo = Cairo({ subsets: ['arabic', 'latin'], weight: ['400', '600', '700'], variable: '--font-cairo', display: 'swap', preload: false });
const almarai = Almarai({ subsets: ['arabic'], weight: ['400', '700', '800'], variable: '--font-almarai', display: 'swap', preload: false });

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const en = locale === 'en';
  return {
    metadataBase: new URL(process.env.PORTAL_URL || 'https://newobour.com'),
    title: en
      ? 'New Obour | Free services portal'
      : 'العبور الجديدة | بوابة الخدمات المجانية',
    // Base description for pages without their own (the homepage overrides with a richer one).
    description: en
      ? 'Free portal for New Obour City residents: legalization-ledger search, lands and units for sale, district and neighborhood guides, city news and per-m² prices.'
      : 'بوابة مجانية لأهالي مدينة العبور الجديدة: البحث في كشوف التقنين، أراضٍ ووحدات معروضة للبيع، دليل الأحياء والمجاورات، وأخبار المدينة ومتوسط أسعار المتر.',
    icons: { icon: '/brand/favicon' },
    alternates: { types: { 'application/rss+xml': [{ url: '/feed.xml', title: en ? 'New Obour — feed' : 'العبور الجديدة — آخر التحديثات' }] } },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = (await getLocale()) as Locale;
  const messages = await getMessages();
  const ids = await prisma.setting.findMany({ where: { key: { in: ['ga4_newobour', 'pixel_newobour', 'gsc_newobour', 'bing_newobour', 'yandex_newobour', SOCIAL_SETTING_KEYS.newobour] } } });
  const s = Object.fromEntries(ids.map((r) => [r.key, r.value]));
  const themeCss = buildThemeCss(await getBrandTheme('newobour'));
  const siteUrl = (process.env.PORTAL_URL || 'https://newobour.com').replace(/\/$/, '');
  const sameAs = parseSocialLinks(s[SOCIAL_SETTING_KEYS.newobour]);
  const jsonLd = [
    { '@context': 'https://schema.org', '@type': 'Organization', name: 'العبور الجديدة', alternateName: 'New Obour', url: siteUrl, logo: `${siteUrl}/brand/logo`, ...(sameAs.length ? { sameAs } : {}) },
    { '@context': 'https://schema.org', '@type': 'WebSite', name: 'العبور الجديدة', alternateName: 'New Obour', url: siteUrl, inLanguage: ['ar', 'en'], potentialAction: { '@type': 'SearchAction', target: `${siteUrl}/rationing?q={search_term_string}`, 'query-input': 'required name=search_term_string' } },
  ];

  return (
    <html
      lang={locale}
      dir={dirForLocale(locale)}
      className={`${tajawal.variable} ${playfair.variable} ${cairo.variable} ${almarai.variable}`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
        {themeCss && <style id="brand-theme" dangerouslySetInnerHTML={{ __html: themeCss }} />}
        {s.gsc_newobour && <meta name="google-site-verification" content={s.gsc_newobour} />}
        {s.bing_newobour && <meta name="msvalidate.01" content={s.bing_newobour} />}
        {s.yandex_newobour && <meta name="yandex-verification" content={s.yandex_newobour} />}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
          <Toaster />
          <Tracker site="newobour" />
          <Analytics ga4Id={s.ga4_newobour} pixelId={s.pixel_newobour} />
          <ConsentBanner />
          <EnterToSubmit />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
