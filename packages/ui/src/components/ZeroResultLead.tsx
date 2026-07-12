'use client';

import { useState } from 'react';
import { isValidPhone } from '@noc/config';
import { submitSearchLead, type SearchLeadSite, type SearchLeadSurface } from '../lib/searchLead';

// Shown on a market/storefront search that returned NOTHING: turn the dead-end into a lead by
// letting the visitor leave a phone (+ optional note). Big, simple, mobile-first — the audience is
// low-literacy on a phone. On success it collapses to a thank-you so it can't be double-submitted.

export function ZeroResultLead({
  site,
  surface,
  query,
  locale,
}: {
  site: SearchLeadSite;
  surface: SearchLeadSurface;
  query: string;
  locale: 'ar' | 'en';
}) {
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState('');

  function submit() {
    setError('');
    if (!isValidPhone(phone)) {
      setError(L('اكتب رقم موبايل صحيح', 'Enter a valid mobile number'));
      return;
    }
    setState('sending');
    void submitSearchLead({ site, surface, query, phone: phone.trim(), note: note.trim() || undefined }).then((r) => {
      if (r.ok) setState('done');
      else {
        setState('idle');
        setError(L('تعذّر الإرسال، حاول مرة أخرى', 'Could not send, please try again'));
      }
    });
  }

  if (state === 'done') {
    return (
      <div className="rounded-2xl border-2 border-green/40 bg-green/10 p-6 text-center">
        <div className="text-3xl">✅</div>
        <p className="mt-2 text-lg font-bold text-primary">{L('تمام! وصلنا طلبك', 'Got it — request received')}</p>
        <p className="mt-1 text-sm opacity-75">{L('هنتواصل معاك على رقمك لما يتوفر المطلوب.', "We'll contact you on your number when a match is available.")}</p>
      </div>
    );
  }

  const inp = 'w-full rounded-xl border-2 border-graphite/25 bg-transparent px-4 py-3 text-base';

  return (
    <div className="rounded-2xl border-2 border-gold-300/60 bg-gold/10 p-5">
      <p className="text-lg font-bold text-primary">{L('مش لاقي اللي بتدور عليه؟', "Didn't find what you want?")}</p>
      <p className="mt-1 text-sm opacity-75">
        {query
          ? L(`سيب رقمك ونتواصل معاك لما يتوفر «${query}».`, `Leave your number and we'll reach out when "${query}" is available.`)
          : L('سيب رقمك ونتواصل معاك لما يتوفر المطلوب.', "Leave your number and we'll reach out when a match is available.")}
      </p>
      <div className="mt-3 space-y-2">
        <input
          type="tel"
          inputMode="tel"
          dir="ltr"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="01xxxxxxxxx"
          className={inp}
          aria-label={L('رقم الموبايل', 'Mobile number')}
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={L('تفاصيل إضافية (اختياري)', 'More details (optional)')}
          className={inp}
          dir="auto"
          aria-label={L('تفاصيل', 'Details')}
        />
        {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
        <button
          type="button"
          onClick={submit}
          disabled={state === 'sending'}
          className="w-full rounded-xl bg-primary px-4 py-3 text-base font-bold text-soft disabled:opacity-50"
        >
          {state === 'sending' ? L('جارٍ الإرسال…', 'Sending…') : L('تواصلوا معي', 'Contact me')}
        </button>
      </div>
    </div>
  );
}
