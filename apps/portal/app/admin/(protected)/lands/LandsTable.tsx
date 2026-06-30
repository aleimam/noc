'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { LandRowActions } from './LandRowActions';

export type LandRow = {
  id: string;
  status: string;
  landType: string;
  typeLabel: string;
  location: string;
  area: number | null;
  areaLabel: string;
  price: number | null;
  priceLabel: string;
  ownerLabel: string;
  statusLabel: string;
  published: boolean;
};
type Opt = { value: string; label: string };
type SortKey = 'location' | 'area' | 'price' | 'status';

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-graphite/10 text-graphite',
  REFINED: 'bg-gold/20 text-graphite',
  READY: 'bg-navy/10 text-primary',
  PUBLISHED: 'bg-green/15 text-green',
  ARCHIVED: 'bg-graphite/10 opacity-60',
};

export function LandsTable({ rows, statusOptions, typeOptions }: { rows: LandRow[]; statusOptions: Opt[]; typeOptions: Opt[] }) {
  const t = useTranslations('lands');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('location');
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');
  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setDir('asc'); }
  };
  const arrow = (k: SortKey) => (sortKey === k ? (dir === 'asc' ? ' ▲' : ' ▼') : '');

  const view = useMemo(() => {
    const n = q.trim().toLowerCase();
    const r = rows.filter(
      (x) => (!status || x.status === status) && (!type || x.landType === type) && (!n || `${x.location} ${x.typeLabel} ${x.ownerLabel}`.toLowerCase().includes(n)),
    );
    r.sort((a, b) => {
      let c = 0;
      if (sortKey === 'area') c = (a.area ?? -1) - (b.area ?? -1);
      else if (sortKey === 'price') c = (a.price ?? -1) - (b.price ?? -1);
      else if (sortKey === 'status') c = a.statusLabel.localeCompare(b.statusLabel, 'ar');
      else c = a.location.localeCompare(b.location, 'ar');
      return dir === 'asc' ? c : -c;
    });
    return r;
  }, [rows, q, status, type, sortKey, dir]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search')} className="w-full max-w-xs rounded-md border border-graphite/20 bg-transparent px-3 py-1.5 text-sm" />
        <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-md border border-graphite/20 bg-transparent px-3 py-1.5 text-sm">
          <option value="">{t('allTypes')}</option>
          {typeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-graphite/20 bg-transparent px-3 py-1.5 text-sm">
          <option value="">{t('allStatuses')}</option>
          {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <span className="text-xs opacity-60">{view.length}/{rows.length}</span>
      </div>

      {view.length === 0 ? (
        <p className="py-12 text-center opacity-60">{t('noLands')}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-graphite/15">
          <table className="w-full whitespace-nowrap text-sm">
            <thead>
              <tr className="opacity-60">
                <th className="p-2 text-start">{t('landType')}</th>
                <th className="p-2 text-start"><button type="button" onClick={() => toggleSort('location')} className="font-semibold hover:text-accent">{t('neighborhood')}{arrow('location')}</button></th>
                <th className="p-2 text-start"><button type="button" onClick={() => toggleSort('area')} className="font-semibold hover:text-accent">{t('area')}{arrow('area')}</button></th>
                <th className="p-2 text-start"><button type="button" onClick={() => toggleSort('price')} className="font-semibold hover:text-accent">{t('price')}{arrow('price')}</button></th>
                <th className="p-2 text-start">{t('ownerKind')}</th>
                <th className="p-2 text-start"><button type="button" onClick={() => toggleSort('status')} className="font-semibold hover:text-accent">{t('status')}{arrow('status')}</button></th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {view.map((l) => (
                <tr key={l.id} className="border-t border-graphite/10">
                  <td className="p-2">{l.typeLabel}</td>
                  <td className="p-2">{l.location}</td>
                  <td className="p-2" dir="ltr">{l.areaLabel}</td>
                  <td className="p-2" dir="ltr">{l.priceLabel}</td>
                  <td className="p-2">{l.ownerLabel}</td>
                  <td className="p-2"><span className={`inline-block rounded px-2 py-0.5 text-xs ${STATUS_COLOR[l.status] ?? ''}`}>{l.statusLabel}</span></td>
                  <td className="p-2 text-end"><LandRowActions id={l.id} published={l.published} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
