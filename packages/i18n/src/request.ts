import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from './index';

// i18n without URL routing: locale comes from the NEXT_LOCALE cookie (set by the
// language switcher), falling back to Arabic. Messages live in @noc/i18n/messages.
export default getRequestConfig(async () => {
  const store = await cookies();
  const cookieLocale = store.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;
  const messages = (await import(`../messages/${locale}.json`)).default;
  return { locale, messages };
});
