import type { Metadata } from 'next';
import { Tajawal, Playfair_Display, Cairo, Almarai } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { dirForLocale, type Locale } from '@noc/i18n';
import { ThemeScript, Analytics, ConsentBanner, EnterToSubmit } from '@noc/ui';
import { buildThemeCss } from '@noc/config';
import { prisma } from '@noc/db';
import { getBrandTheme } from '../lib/theme';
import './globals.css';

const tajawal = Tajawal({ subsets: ['arabic', 'latin'], weight: ['300', '400', '500', '700', '800', '900'], variable: '--font-tajawal', display: 'swap' });
const playfair = Playfair_Display({ subsets: ['latin'], weight: ['400', '600', '700'], variable: '--font-playfair', display: 'swap' });
const cairo = Cairo({ subsets: ['arabic', 'latin'], weight: ['400', '600', '700'], variable: '--font-cairo', display: 'swap', preload: false });
const almarai = Almarai({ subsets: ['arabic'], weight: ['400', '700', '800'], variable: '--font-almarai', display: 'swap', preload: false });

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const en = locale === 'en';
  return {
    metadataBase: new URL(process.env.BROKERAGE_URL || 'https://alsawarey.com'),
    title: en ? 'ALSWARY Real-estate Investment' : 'الصواري للاستثمار العقاري',
    description: en
      ? 'ALSWARY Real-estate Investment — selected lands for sale in New Obour and beyond'
      : 'الصواري للاستثمار العقاري — أراضٍ مختارة للبيع في العبور الجديدة وما حولها',
    icons: { icon: '/brand/favicon' },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = (await getLocale()) as Locale;
  const messages = await getMessages();
  const ids = await prisma.setting.findMany({ where: { key: { in: ['ga4_alsawarey', 'pixel_alsawarey', 'gsc_alsawarey'] } } });
  const s = Object.fromEntries(ids.map((r) => [r.key, r.value]));
  const themeCss = buildThemeCss(await getBrandTheme('alsawarey'));

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
        {s.gsc_alsawarey && <meta name="google-site-verification" content={s.gsc_alsawarey} />}
      </head>
      <body className="min-h-screen font-sans antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
          <Analytics ga4Id={s.ga4_alsawarey} pixelId={s.pixel_alsawarey} />
          <ConsentBanner />
          <EnterToSubmit />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
