'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { formatMoneyEgp } from '@noc/config';
import { makeOffer, respondNegotiation } from '../account/offers/actions';

type Offer = { byRole: string; amount: number; note: string | null };
export type NegoData = { id: string; status: string; offers: Offer[] } | null;

// Peer price negotiation UI, shared by the listing page (role=buyer) and the account
// offers page (buyer or seller). Structured offers with accept / reject / counter / withdraw.
export function NegotiationThread({
  role,
  listingId,
  negotiation,
  locale,
  compact,
}: {
  role: 'buyer' | 'seller';
  listingId: string;
  negotiation: NegoData;
  locale: 'ar' | 'en';
  compact?: boolean;
}) {
  const t = useTranslations('mp');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const myRole = role === 'buyer' ? 'BUYER' : 'SELLER';
  const status = negotiation?.status ?? null;
  const offers = negotiation?.offers ?? [];
  const last = offers[offers.length - 1];
  const isOpen = !negotiation || status === 'OPEN';
  const awaitingMe = isOpen && !!last && last.byRole !== myRole;
  const iMadeLast = isOpen && !!last && last.byRole === myRole;

  function sendOffer() {
    const n = Number(amount);
    if (!(n > 0)) { setError(t('negoInvalidAmount')); return; }
    setError('');
    start(async () => {
      const r = negotiation && negotiation.status === 'OPEN'
        ? await respondNegotiation(negotiation.id, 'counter', n, note)
        : await makeOffer(listingId, n, note);
      if (r.ok) { setAmount(''); setNote(''); router.refresh(); } else setError(t('negoError'));
    });
  }
  function act(action: 'accept' | 'reject' | 'withdraw') {
    if (!negotiation) return;
    start(async () => {
      const r = await respondNegotiation(negotiation.id, action);
      if (r.ok) router.refresh(); else setError(t('negoError'));
    });
  }

  const statusLabel = status === 'ACCEPTED' ? t('negoStatusAccepted') : status === 'REJECTED' ? t('negoStatusRejected') : status === 'WITHDRAWN' ? t('negoStatusWithdrawn') : t('negoStatusOpen');
  const statusColor = status === 'ACCEPTED' ? 'text-success' : status === 'REJECTED' || status === 'WITHDRAWN' ? 'text-red-600' : 'text-navy-600';

  return (
    <div className={`space-y-3 rounded-2xl border border-ink-200 bg-white p-4 ${compact ? '' : 'shadow-sm'}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-bold text-navy-800">{t('negoTitle')}</h3>
        {negotiation && <span className={`text-sm font-bold ${statusColor}`}>{statusLabel}</span>}
      </div>

      {offers.length > 0 && (
        <ul className="space-y-1.5 text-sm">
          {offers.map((o, i) => (
            <li key={i} className="flex items-center justify-between gap-2 rounded-lg bg-navy-50 px-3 py-1.5">
              <span className="font-medium text-navy-700">{o.byRole === 'BUYER' ? t('negoBuyer') : t('negoSeller')}</span>
              <span className="font-num font-bold text-navy-800" dir="ltr">{formatMoneyEgp(o.amount, locale)}</span>
            </li>
          ))}
        </ul>
      )}
      {last?.note && <p className="text-sm text-ink-600">“{last.note}”</p>}

      {/* Respond to the other party's latest offer */}
      {awaitingMe && (
        <div className="flex flex-wrap gap-2">
          <button disabled={pending} onClick={() => act('accept')} className="rounded-lg bg-success px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{t('negoAccept')}</button>
          <button disabled={pending} onClick={() => act(role === 'buyer' ? 'withdraw' : 'reject')} className="rounded-lg border border-red-300 px-4 py-2 text-sm font-bold text-red-600 disabled:opacity-50">{role === 'buyer' ? t('negoWithdraw') : t('negoReject')}</button>
        </div>
      )}
      {iMadeLast && <p className="text-sm text-ink-500">{t('negoAwaiting')}</p>}

      {/* Make / counter offer (buyer can always re-offer unless accepted) */}
      {status !== 'ACCEPTED' && (
        <div className="space-y-2 border-t border-ink-100 pt-3">
          <label className="block text-sm font-medium text-navy-700">{negotiation && isOpen ? t('negoCounter') : t('negoYourOffer')}</label>
          <div className="flex gap-2">
            <input value={amount} onChange={(e) => setAmount(e.target.value)} dir="ltr" inputMode="numeric" placeholder="0" className="w-40 rounded-xl border border-ink-200 bg-white px-3 py-2 text-lg font-bold text-navy-900" />
            <button disabled={pending} onClick={sendOffer} className="rounded-xl bg-gold px-6 py-2 font-bold text-navy-900 disabled:opacity-50">{t('negoSend')}</button>
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('negoNote')} className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm" />
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
