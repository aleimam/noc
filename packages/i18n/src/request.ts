import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from './index';

// i18n without URL routing: an explicit choice in the NEXT_LOCALE cookie (set by
// the language switcher) always wins. Otherwise the default depends on audience —
// the admin area defaults to English (staff/our users), while customer & public
// areas, plus the brokerage app (which has no admin), default to Arabic. The
// middleware stamps x-pathname so this server-only config can tell them apart.
export default getRequestConfig(async () => {
  const store = await cookies();
  const cookieLocale = store.get(LOCALE_COOKIE)?.value;

  let path = '';
  try {
    path = (await headers()).get('x-pathname') ?? '';
  } catch {
    // headers() unavailable (e.g. static context) — fall through to Arabic default.
  }
  const areaDefault: Locale = path.startsWith('/admin') ? 'en' : DEFAULT_LOCALE;

  const locale = isLocale(cookieLocale) ? cookieLocale : areaDefault;
  const messages = (await import(`../messages/${locale}.json`)).default;
  return { locale, messages };
});
