'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { waPhone } from '@noc/config';
import { setLeadStatus, deleteLead } from './actions';

export type LeadRow = {
  id: string;
  site: string;
  surface: string;
  query: string;
  phone: string;
  name: string | null;
  note: string | null;
  status: string;
  createdAt: string; // pre-formatted on the server
};

const STATUSES = ['NEW', 'CONTACTED', 'CLOSED'] as const;

export function LeadInbox({ leads, locale }: { leads: LeadRow[]; locale: 'ar' | 'en' }) {
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [filter, setFilter] = useState<'NEW' | 'all'>('NEW');

  const statusLabel = (s: string) => (s === 'NEW' ? L('جديد', 'New') : s === 'CONTACTED' ? L('تم التواصل', 'Contacted') : L('مغلق', 'Closed'));
  const statusChip = (s: string) => (s === 'NEW' ? 'bg-gold/20 text-navy-800' : s === 'CONTACTED' ? 'bg-blue-100 text-blue-800' : 'bg-graphite/15 text-graphite/70');
  const siteLabel = (s: string) => (s === 'newobour' ? 'New Obour' : 'Al Sawarey');

  const shown = filter === 'NEW' ? leads.filter((l) => l.status === 'NEW') : leads;

  function setStatus(id: string, status: string) {
    start(async () => { await setLeadStatus(id, status); router.refresh(); });
  }
  function remove(id: string) {
    if (!confirm(L('حذف هذا الطلب؟', 'Delete this lead?'))) return;
    start(async () => { await deleteLead(id); router.refresh(); });
  }

  return (
    <div className="rounded-lg border border-graphite/15 p-4">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-primary">{L('طلبات بلا نتائج (طلب غير ملبّى)', 'Zero-result leads (unmet demand)')}</h3>
        <div className="flex items-center gap-1.5">
          {(['NEW', 'all'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-3 py-1 text-sm font-semibold ${filter === f ? 'bg-primary text-soft' : 'border border-graphite/25 hover:bg-graphite/10'}`}>
              {f === 'NEW' ? L('الجديدة', 'New') : L('الكل', 'All')}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-3 text-xs opacity-60">
        {L('زوّار بحثوا ولم يجدوا نتيجة وتركوا رقمهم — تواصل معهم لتحويلهم لعملاء.', 'Visitors who searched, found nothing, and left a number — reach out to convert them.')}
      </p>

      {shown.length === 0 ? (
        <p className="text-xs opacity-50">{L('لا توجد طلبات.', 'No leads.')}</p>
      ) : (
        <div className="space-y-2">
          {shown.map((l) => (
            <div key={l.id} className={`rounded-lg border border-graphite/15 p-3 ${l.status === 'NEW' ? '' : 'opacity-70'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold" dir="auto">🔎 {l.query || L('(بحث فارغ)', '(empty search)')}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${statusChip(l.status)}`}>{statusLabel(l.status)}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <a href={`tel:${l.phone}`} dir="ltr" className="font-num font-semibold text-accent hover:underline">{l.phone}</a>
                <a href={`https://wa.me/${waPhone(l.phone)}`} target="_blank" rel="noopener noreferrer" className="text-green hover:underline">WhatsApp</a>
                {l.name && <span className="opacity-70">{l.name}</span>}
                <span className="text-xs opacity-50">{siteLabel(l.site)} · {l.surface}</span>
                <span className="text-xs opacity-50" dir="ltr">{l.createdAt}</span>
              </div>
              {l.note && <p className="mt-1 text-sm opacity-80" dir="auto">“{l.note}”</p>}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                {STATUSES.filter((s) => s !== l.status).map((s) => (
                  <button key={s} onClick={() => setStatus(l.id, s)} disabled={pending} className="rounded border border-graphite/25 px-2 py-0.5 hover:bg-graphite/10">
                    → {statusLabel(s)}
                  </button>
                ))}
                <button onClick={() => remove(l.id)} disabled={pending} className="ms-auto text-red-600 hover:underline">{L('حذف', 'Delete')}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
