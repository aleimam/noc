import type { Metadata } from 'next';
import { Tajawal, Playfair_Display } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { dirForLocale, type Locale } from '@noc/i18n';
import { ThemeScript, Analytics, ConsentBanner } from '@noc/ui';
import { prisma } from '@noc/db';
import './globals.css';

const tajawal = Tajawal({ subsets: ['arabic', 'latin'], weight: ['300', '400', '500', '700', '800', '900'], variable: '--font-tajawal', display: 'swap' });
const playfair = Playfair_Display({ subsets: ['latin'], weight: ['400', '600', '700'], variable: '--font-playfair', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.PORTAL_URL || 'https://newobour.com'),
  title: 'New Obour — newobour.com',
  description: 'New Obour City — community services portal',
  icons: { icon: '/brand/favicon' },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = (await getLocale()) as Locale;
  const messages = await getMessages();
  const ids = await prisma.setting.findMany({ where: { key: { in: ['ga4_newobour', 'pixel_newobour', 'gsc_newobour'] } } });
  const s = Object.fromEntries(ids.map((r) => [r.key, r.value]));

  return (
    <html
      lang={locale}
      dir={dirForLocale(locale)}
      className={`${tajawal.variable} ${playfair.variable}`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
        {s.gsc_newobour && <meta name="google-site-verification" content={s.gsc_newobour} />}
      </head>
      <body className="min-h-screen font-sans antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
          <Analytics ga4Id={s.ga4_newobour} pixelId={s.pixel_newobour} />
          <ConsentBanner />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
