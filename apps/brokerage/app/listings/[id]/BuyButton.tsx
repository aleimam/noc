'use client';

import { useState, useTransition } from 'react';
import { createContactRequest } from './actions';
import { waLink } from '../../../lib/store';

export function BuyButton({ listingId, waText, label, sentLabel }: { listingId: string; waText: string; label: string; sentLabel: string }) {
  const [pending, start] = useTransition();
  const [sent, setSent] = useState(false);

  function buy() {
    // open WhatsApp immediately (user gesture), record the lead in the background
    window.open(waLink(waText), '_blank', 'noopener');
    start(async () => {
      await createContactRequest({ listingId, message: waText });
      setSent(true);
    });
  }

  return (
    <button
      onClick={buy}
      disabled={pending}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-success px-6 py-3.5 text-lg font-bold text-white transition hover:brightness-105 disabled:opacity-60 sm:w-auto"
    >
      <span aria-hidden>🟢</span> {sent ? sentLabel : label}
    </button>
  );
}
