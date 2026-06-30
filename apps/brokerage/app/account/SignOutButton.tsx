'use client';

import { signOut } from 'next-auth/react';

export function SignOutButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={async () => {
        await signOut({ redirect: false });
        window.location.href = '/';
      }}
      className="rounded-xl border border-ink-200 px-4 py-2 text-sm hover:bg-ink-100"
    >
      {label}
    </button>
  );
}
