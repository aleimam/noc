'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { ImageAttachment, type UploadedAttachment } from '@noc/ui';
import { SHEET_LOCATIONS } from '@noc/config';
import { upsertLand } from './actions';

type NB = { id: string; label: string; blocks: { id: string; name: string }[] };
export type LandFormInitial = {
  id?: string;
  landType: 'SHEETS' | 'ALLOCATED';
  neighborhoodId: string;
  blockId: string;
  pieceNo: string;
  sheetLocation: string;
  area: string;
  allocationDate: string;
  utilitiesStatus: string;
  price: string;
  ownerKind: 'BROKER' | 'OWNER' | 'PERSONAL';
  ownerId: string;
  details: string;
  status: 'DRAFT' | 'REFINED' | 'READY' | 'PUBLISHED' | 'ARCHIVED';
  photos: UploadedAttachment[];
};

const LAND_TYPES = ['SHEETS', 'ALLOCATED'] as const;
const OWNER_KINDS = ['PERSONAL', 'OWNER', 'BROKER'] as const;
const STATUSES = ['DRAFT', 'REFINED', 'READY', 'ARCHIVED'] as const;
const inp = 'w-full rounded-md border border-graphite/20 bg-transparent px-3 py-2 text-sm';

export function LandForm({ initial, neighborhoods, owners, locale }: { initial: LandFormInitial; neighborhoods: NB[]; owners: { id: string; name: string }[]; locale: 'ar' | 'en' }) {
  const t = useTranslations('lands');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const [f, setF] = useState<LandFormInitial>(initial);
  const set = (patch: Partial<LandFormInitial>) => setF((s) => ({ ...s, ...patch }));

  const allocated = f.landType === 'ALLOCATED';
  const commercial = f.ownerKind === 'BROKER' || f.ownerKind === 'OWNER';
  const blocks = neighborhoods.find((n) => n.id === f.neighborhoodId)?.blocks ?? [];

  function submit() {
    setError('');
    start(async () => {
      const r = await upsertLand({
        id: f.id,
        landType: f.landType,
        neighborhoodId: f.neighborhoodId || null,
        blockId: f.blockId || null,
        pieceNo: f.pieceNo,
        sheetLocation: f.sheetLocation,
        area: f.area,
        allocationDate: f.allocationDate,
        utilitiesStatus: f.utilitiesStatus,
        price: f.price,
        ownerKind: f.ownerKind,
        ownerId: f.ownerId || null,
        details: f.details,
        status: f.status,
        photoIds: f.photos.map((p) => p.id),
      });
      if (r.ok) router.push('/admin/lands/lands');
      else setError(r.error);
    });
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">{t('landType')}
          <select value={f.landType} onChange={(e) => set({ landType: e.target.value as LandFormInitial['landType'] })} className={inp}>
            {LAND_TYPES.map((x) => <option key={x} value={x}>{t(`type${x}`)}</option>)}
          </select>
        </label>
        <label className="text-sm">{t('status')}
          <select value={f.status} onChange={(e) => set({ status: e.target.value as LandFormInitial['status'] })} className={inp}>
            {STATUSES.map((x) => <option key={x} value={x}>{t(`status${x}`)}</option>)}
            {f.status === 'PUBLISHED' && <option value="PUBLISHED">{t('statusPUBLISHED')}</option>}
          </select>
        </label>
      </div>

      {allocated ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">{t('neighborhood')}
            <select value={f.neighborhoodId} onChange={(e) => set({ neighborhoodId: e.target.value, blockId: '' })} className={inp}>
              <option value="">{t('pickNeighborhood')}</option>
              {neighborhoods.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
            </select>
          </label>
          <label className="text-sm">{t('block')}
            <select value={f.blockId} onChange={(e) => set({ blockId: e.target.value })} className={inp} disabled={!blocks.length}>
              <option value="">{t('pickBlock')}</option>
              {blocks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label className="text-sm">{t('pieceNo')}<input value={f.pieceNo} onChange={(e) => set({ pieceNo: e.target.value })} className={inp} /></label>
          <label className="text-sm">{t('allocationDate')}<input type="date" dir="ltr" value={f.allocationDate} onChange={(e) => set({ allocationDate: e.target.value })} className={inp} /></label>
          <label className="text-sm sm:col-span-2">{t('utilitiesStatus')}<input value={f.utilitiesStatus} onChange={(e) => set({ utilitiesStatus: e.target.value })} className={inp} /></label>
        </div>
      ) : (
        <label className="block text-sm">{t('sheetLocation')}
          <select value={f.sheetLocation} onChange={(e) => set({ sheetLocation: e.target.value })} className={inp}>
            <option value="">—</option>
            {SHEET_LOCATIONS.map((s) => <option key={s.key} value={s.key}>{locale === 'ar' ? s.ar : s.en}</option>)}
          </select>
        </label>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">{t('area')} (م²)<input type="number" dir="ltr" value={f.area} onChange={(e) => set({ area: e.target.value })} className={inp} /></label>
        <label className="text-sm">{t('price')}<input type="number" dir="ltr" value={f.price} onChange={(e) => set({ price: e.target.value })} className={inp} /></label>
        <label className="text-sm">{t('ownerKind')}
          <select value={f.ownerKind} onChange={(e) => set({ ownerKind: e.target.value as LandFormInitial['ownerKind'] })} className={inp}>
            {OWNER_KINDS.map((x) => <option key={x} value={x}>{t(`kind${x}`)}</option>)}
          </select>
        </label>
        {commercial && (
          <label className="text-sm">{t('pickOwner')}
            <select value={f.ownerId} onChange={(e) => set({ ownerId: e.target.value })} className={inp}>
              <option value="">{t('none')}</option>
              {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
        )}
      </div>

      <label className="block text-sm">{t('details')}<textarea value={f.details} onChange={(e) => set({ details: e.target.value })} rows={3} className={inp} /></label>

      <div className="space-y-2">
        <div className="text-sm font-semibold">{t('photos')}</div>
        <div className="flex flex-wrap gap-2">
          {f.photos.map((p) => (
            <span key={p.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.path} alt="" className="h-16 w-16 rounded object-cover ring-1 ring-graphite/20" />
              <button type="button" onClick={() => set({ photos: f.photos.filter((x) => x.id !== p.id) })} className="absolute -end-1 -top-1 rounded-full bg-red-600 px-1 text-xs text-white">✕</button>
            </span>
          ))}
          <div className="w-28"><ImageAttachment value={null} onChange={(a) => a && set({ photos: [...f.photos, a] })} /></div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button disabled={pending} onClick={submit} className="rounded-md bg-primary px-5 py-2 text-sm text-soft disabled:opacity-50">{t('save')}</button>
        <a href="/admin/lands/lands" className="px-3 py-2 text-sm opacity-70">{t('cancel')}</a>
      </div>
    </div>
  );
}
