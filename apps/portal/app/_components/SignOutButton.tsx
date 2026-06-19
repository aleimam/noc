'use client';

import { signOut } from 'next-auth/react';
import { useTranslations } from 'next-intl';

export function SignOutButton() {
  const t = useTranslations('auth');
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: '/' })}
      className="rounded-md border border-graphite/20 px-3 py-1.5 text-sm hover:bg-graphite/10"
    >
      {t('signOut')}
    </button>
  );
}
