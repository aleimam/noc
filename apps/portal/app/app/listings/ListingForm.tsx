'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ImageAttachment, Lightbox, type UploadedAttachment } from '@noc/ui';
import { localizeUnit } from '@noc/i18n';
import { saveListing, type ListingInput, type ValueInput } from './actions';

type AttrType = 'TEXT' | 'TEXTAREA' | 'NUMBER' | 'BOOLEAN' | 'SELECT' | 'MULTI_SELECT';
type Opt = { id: string; labelAr: string; labelEn: string };
type Attr = { id: string; sectionId: string; labelAr: string; labelEn: string; type: AttrType; unit: string | null; order: number; options: Opt[]; typeIds: string[] };
type Section = { id: string; nameAr: string; nameEn: string; order: number };
type PType = { id: string; nameAr: string; nameEn: string };
type OwnerOpt = { id: string; name: string; type: string };

export type ListingFormInitial = {
  id?: string;
  propertyTypeId: string;
  title: string;
  description: string;
  price: string;
  priceNote: string;
  contactPhone: string;
  contactWhatsapp: boolean;
  ownerId: string;
  ownerName: string;
  ownerType: string;
  showOnBrokerage: boolean;
  vals: Record<string, string | boolean | string[]>;
  photos: UploadedAttachment[];
};

const inp = 'w-full rounded-md border border-graphite/20 bg-transparent px-3 py-2 text-sm';

export function ListingForm({
  propertyTypes,
  sections,
  attributes,
  initial,
  locale,
  staffMode = false,
  owners = [],
}: {
  propertyTypes: PType[];
  sections: Section[];
  attributes: Attr[];
  initial: ListingFormInitial;
  locale: 'ar' | 'en';
  staffMode?: boolean;
  owners?: OwnerOpt[];
}) {
  const t = useTranslations('mp');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState<string | null>(null);

  const [typeId, setTypeId] = useState(initial.propertyTypeId);
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [price, setPrice] = useState(initial.price);
  const [priceNote, setPriceNote] = useState(initial.priceNote);
  const [contactPhone, setContactPhone] = useState(initial.contactPhone);
  const [contactWhatsapp, setContactWhatsapp] = useState(initial.contactWhatsapp);
  const [ownerId, setOwnerId] = useState(initial.ownerId);
  const [ownerName, setOwnerName] = useState(initial.ownerName);
  const [ownerType, setOwnerType] = useState(initial.ownerType || 'OWNER');
  const [showOnBrokerage, setShowOnBrokerage] = useState(initial.showOnBrokerage);
  const [vals, setVals] = useState<Record<string, string | boolean | string[]>>(initial.vals);
  const [photos, setPhotos] = useState<UploadedAttachment[]>(initial.photos);

  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const setVal = (id: string, v: string | boolean | string[]) => setVals((p) => ({ ...p, [id]: v }));

  const grouped = useMemo(() => {
    const applicable = attributes.filter((a) => a.typeIds.includes(typeId));
    return sections
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((s) => ({ section: s, attrs: applicable.filter((a) => a.sectionId === s.id).sort((a, b) => a.order - b.order) }))
      .filter((g) => g.attrs.length > 0);
  }, [attributes, sections, typeId]);

  function buildValues(): ValueInput[] {
    const out: ValueInput[] = [];
    for (const a of attributes) {
      if (!a.typeIds.includes(typeId)) continue;
      const v = vals[a.id];
      if (a.type === 'BOOLEAN') {
        if (v === true) out.push({ attributeId: a.id, bool: true });
      } else if (a.type === 'NUMBER') {
        if (typeof v === 'string' && v.trim() !== '') out.push({ attributeId: a.id, number: Number(v) });
      } else if (a.type === 'SELECT') {
        if (typeof v === 'string' && v) out.push({ attributeId: a.id, optionIds: [v] });
      } else if (a.type === 'MULTI_SELECT') {
        if (Array.isArray(v) && v.length) out.push({ attributeId: a.id, optionIds: v });
      } else if (typeof v === 'string' && v.trim() !== '') {
        out.push({ attributeId: a.id, text: v });
      }
    }
    return out;
  }

  function submit(status: 'DRAFT' | 'PENDING') {
    setError('');
    if (!typeId || !title.trim() || !contactPhone.trim()) {
      setError('failed');
      return;
    }
    const input: ListingInput = {
      id: initial.id,
      propertyTypeId: typeId,
      title,
      description,
      price: price.trim() ? Number(price) : null,
      priceNote,
      contactPhone,
      contactWhatsapp,
      ownerId: ownerId || null,
      ownerName,
      ownerType: ownerType as 'OWNER' | 'COMPANY' | 'BROKER' | 'US',
      showOnBrokerage,
      values: buildValues(),
      photoIds: photos.map((p) => p.id),
      status,
    };
    start(async () => {
      const r = await saveListing(input);
      if (r.ok) router.push(staffMode ? '/admin/marketplace/listings' : '/app/listings');
      else setError(r.error);
    });
  }

  function control(a: Attr) {
    const v = vals[a.id];
    if (a.type === 'TEXTAREA') return <textarea value={(v as string) ?? ''} onChange={(e) => setVal(a.id, e.target.value)} rows={2} className={inp} />;
    if (a.type === 'NUMBER')
      return (
        <div className="flex items-center gap-2">
          <input type="number" value={(v as string) ?? ''} onChange={(e) => setVal(a.id, e.target.value)} className={inp} />
          {a.unit && <span className="text-xs opacity-60">{localizeUnit(a.unit, locale)}</span>}
        </div>
      );
    if (a.type === 'BOOLEAN') return <input type="checkbox" checked={v === true} onChange={(e) => setVal(a.id, e.target.checked)} />;
    if (a.type === 'SELECT')
      return (
        <select value={(v as string) ?? ''} onChange={(e) => setVal(a.id, e.target.value)} className={inp}>
          <option value="">—</option>
          {a.options.map((o) => (<option key={o.id} value={o.id}>{L(o.labelAr, o.labelEn)}</option>))}
        </select>
      );
    if (a.type === 'MULTI_SELECT') {
      const arr = Array.isArray(v) ? v : [];
      return (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {a.options.map((o) => (
            <label key={o.id} className="flex items-center gap-1 text-sm">
              <input type="checkbox" checked={arr.includes(o.id)} onChange={() => setVal(a.id, arr.includes(o.id) ? arr.filter((x) => x !== o.id) : [...arr, o.id])} />
              {L(o.labelAr, o.labelEn)}
            </label>
          ))}
        </div>
      );
    }
    return <input value={(v as string) ?? ''} onChange={(e) => setVal(a.id, e.target.value)} className={inp} />;
  }

  return (
    <div className="max-w-3xl space-y-5">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <label className="block text-sm">
        {t('pickType')}
        <select value={typeId} onChange={(e) => setTypeId(e.target.value)} className={inp}>
          <option value="">—</option>
          {propertyTypes.map((p) => (<option key={p.id} value={p.id}>{L(p.nameAr, p.nameEn)}</option>))}
        </select>
      </label>

      <label className="block text-sm">{t('listingTitle')}<input value={title} onChange={(e) => setTitle(e.target.value)} className={inp} /></label>
      <label className="block text-sm">{t('description')}<textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inp} /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">{t('price')}<input type="number" dir="ltr" value={price} onChange={(e) => setPrice(e.target.value)} className={inp} /></label>
        <label className="text-sm">{t('priceNote')}<input value={priceNote} onChange={(e) => setPriceNote(e.target.value)} className={inp} /></label>
      </div>

      {/* Owner + channel */}
      {staffMode ? (
        <div className="grid gap-4 rounded-lg border border-graphite/15 p-4 sm:grid-cols-2">
          <label className="text-sm">
            {t('owner')}
            <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className={inp}>
              <option value="">{t('none')}</option>
              {owners.map((o) => (<option key={o.id} value={o.id}>{o.name} ({t(`type${o.type}`)})</option>))}
            </select>
          </label>
          <label className="flex items-end gap-2 text-sm"><input type="checkbox" checked={showOnBrokerage} onChange={(e) => setShowOnBrokerage(e.target.checked)} /> {t('showOnBrokerage')}</label>
        </div>
      ) : (
        <div className="grid gap-4 rounded-lg border border-graphite/15 p-4 sm:grid-cols-2">
          <label className="text-sm">{t('owner')} — {t('ownerName')}<input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} className={inp} /></label>
          <label className="text-sm">
            {t('ownerType')}
            <select value={ownerType} onChange={(e) => setOwnerType(e.target.value)} className={inp}>
              <option value="OWNER">{t('typeOWNER')}</option>
              <option value="COMPANY">{t('typeCOMPANY')}</option>
              <option value="BROKER">{t('typeBROKER')}</option>
            </select>
          </label>
        </div>
      )}

      {typeId &&
        grouped.map((g) => (
          <div key={g.section.id} className="space-y-3 rounded-lg border border-graphite/15 p-4">
            <h3 className="font-semibold text-primary">{L(g.section.nameAr, g.section.nameEn)}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {g.attrs.map((a) => (
                <label key={a.id} className="text-sm">
                  <span className="mb-1 block opacity-80">{L(a.labelAr, a.labelEn)}</span>
                  {control(a)}
                </label>
              ))}
            </div>
          </div>
        ))}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">{t('photos')}</h3>
        <div className="flex flex-wrap gap-3">
          {photos.map((p) => (
            <div key={p.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.path} alt="" onClick={() => setZoom(p.path)} className="h-20 w-20 cursor-pointer rounded-md object-cover ring-1 ring-graphite/20" />
              <button type="button" onClick={() => setPhotos(photos.filter((x) => x.id !== p.id))} className="absolute -end-1 -top-1 rounded-full bg-red-600 px-1.5 text-xs text-white">✕</button>
            </div>
          ))}
          <div className="w-48">
            <ImageAttachment value={null} onChange={(a) => a && setPhotos((prev) => [...prev, a])} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">{t('contactPhone')}<input type="tel" dir="ltr" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={inp} /></label>
        <label className="flex items-end gap-2 text-sm"><input type="checkbox" checked={contactWhatsapp} onChange={(e) => setContactWhatsapp(e.target.checked)} /> {t('whatsapp')}</label>
      </div>

      <div className="flex flex-wrap gap-3">
        <button disabled={pending} onClick={() => submit('PENDING')} className="rounded-md bg-primary px-4 py-2 text-sm text-soft disabled:opacity-50">{t('submitOffer')}</button>
        <button disabled={pending} onClick={() => submit('DRAFT')} className="rounded-md border border-graphite/25 px-4 py-2 text-sm">{t('saveDraft')}</button>
        <a href={staffMode ? '/admin/marketplace/listings' : '/app/listings'} className="px-4 py-2 text-sm opacity-70">{t('cancel')}</a>
      </div>

      {zoom && <Lightbox src={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}
