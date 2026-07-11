import { getTranslations } from 'next-intl/server';
import { waPhone } from '@noc/config';

// Official-source notice (req #11) — shown on the rationing surfaces with a link to the
// Authority's Facebook page where the sheets are published.
const FB_URL = 'https://www.facebook.com/profile.php?id=100069065355149';

export async function FbNotice() {
  const t = await getTranslations('rationing');
  return (
    <a
      href={FB_URL}
      target="_blank"
      rel="noreferrer"
      className="block rounded-xl border border-navy-100 bg-navy-50 px-4 py-3 text-center text-navy-700 dark:text-navy-200"
    >
      <span aria-hidden>ℹ️ </span>
      {t('fbNotice')} <span className="font-bold text-navy-800 underline dark:text-gold">{t('fbSource')} ↗</span>
    </a>
  );
}

// Big WhatsApp help button (Golden Rule) — hidden until an admin sets the number.
export async function HelpButton({ number }: { number: string }) {
  if (!number) return null;
  const t = await getTranslations('rationing');
  const href = `https://wa.me/${waPhone(number)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-center gap-2 rounded-2xl bg-green px-6 py-4 text-xl font-bold text-white shadow-md transition hover:brightness-105"
    >
      <span aria-hidden>💬</span> {t('helpCta')}
    </a>
  );
}
