'use client';

import { signOut } from 'next-auth/react';
import { useTranslations } from 'next-intl';

export function SignOutButton() {
  const t = useTranslations('auth');
  return (
    <button
      type="button"
      onClick={async () => {
        // Clear the session, then navigate client-side on the current origin.
        // Avoids next-auth resolving a redirect URL that — behind the reverse
        // proxy — can point at the wrong host.
        await signOut({ redirect: false });
        window.location.href = '/';
      }}
      className="rounded-md border border-graphite/20 px-3 py-1.5 text-sm hover:bg-graphite/10"
    >
      {t('signOut')}
    </button>
  );
}
