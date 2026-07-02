'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ImageAttachment, Lightbox, type UploadedAttachment } from '@noc/ui';
import { localizeUnit } from '@noc/i18n';
import { saveListing, type ListingInput, type ValueInput } from './actions';

type AttrType = 'TEXT' | 'TEXTAREA' | 'NUMBER' | 'BOOLEAN' | 'SELECT' | 'MULTI_SELECT' | 'DATE' | 'PHOTOS' | 'DOCUMENTS';
type Opt = { id: string; labelAr: string; labelEn: string };
type Attr = { id: string; sectionId: string; labelAr: string; labelEn: string; type: AttrType; unit: string | null; order: number; options: Opt[]; optionIds: string[] };
type Section = { id: string; nameAr: string; nameEn: string; order: number };
type ClsOpt = { id: string; nameAr: string; nameEn: string; parentIds: string[]; allowedOnAlsawarey: boolean };
type Classifier = { id: string; key: string; nameAr: string; nameEn: string; options: ClsOpt[] };
type OwnerOpt = { id: string; name: string; type: string };

export type ListingFormInitial = {
  id?: string;
  typeOptionId: string;
  purposeOptionId: string;
  conditionOptionId: string;
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
  attachs: Record<string, UploadedAttachment[]>;
};

const inp = 'w-full rounded-md border border-graphite/20 bg-transparent px-3 py-2 text-sm';

export function ListingForm({
  classifiers,
  sections,
  attributes,
  initial,
  locale,
  staffMode = false,
  owners = [],
}: {
  classifiers: Classifier[];
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

  const optCls = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of classifiers) for (const o of c.options) m.set(o.id, c.id);
    return m;
  }, [classifiers]);

  const [selected, setSelected] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const c of classifiers) {
      init[c.id] =
        c.key === 'type' ? initial.typeOptionId : c.key === 'purpose' ? initial.purposeOptionId : c.key === 'condition' ? initial.conditionOptionId : '';
    }
    return init;
  });
  const clsById = useMemo(() => new Map(classifiers.map((c) => [c.id, c])), [classifiers]);
  const clsByKey = useMemo(() => new Map(classifiers.map((c) => [c.key, c])), [classifiers]);
  const selOf = (key: string) => {
    const c = clsByKey.get(key);
    return c ? selected[c.id] ?? '' : '';
  };
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [price, setPrice] = useState(initial.price);
  const [priceNote, setPriceNote] = useState(initial.priceNote);
  const [contactPhone, setContactPhone] = useState(initial.contactPhone);
  const [contactWhatsapp, setContactWhatsapp] = useState(initial.contactWhatsapp);
  const [ownerId, setOwnerId] = useState(initial.ownerId);
  const [ownerName, setOwnerName] = useState(initial.ownerName);
  const [ownerType, setOwnerType] = useState(initial.ownerType || 'PERSONAL');
  const [showOnBrokerage, setShowOnBrokerage] = useState(initial.showOnBrokerage);
  const [vals, setVals] = useState<Record<string, string | boolean | string[]>>(initial.vals);
  const [photos, setPhotos] = useState<UploadedAttachment[]>(initial.photos);
  const [attachs, setAttachs] = useState<Record<string, UploadedAttachment[]>>(initial.attachs);

  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const setVal = (id: string, v: string | boolean | string[]) => setVals((p) => ({ ...p, [id]: v }));

  // Al-Sawarey channel is only chosen in staff mode; gating applies while it's on.
  const alsawarey = staffMode && showOnBrokerage;

  // Choosing a parent classifier clears its descendants (hard nesting Type→Purpose→Status).
  function setSel(cid: string, oid: string) {
    setSelected((prev) => {
      const next = { ...prev, [cid]: oid };
      const key = clsById.get(cid)?.key;
      if (key === 'type') { const p = clsByKey.get('purpose'); const cd = clsByKey.get('condition'); if (p) next[p.id] = ''; if (cd) next[cd.id] = ''; }
      if (key === 'purpose') { const cd = clsByKey.get('condition'); if (cd) next[cd.id] = ''; }
      return next;
    });
  }

  // Options visible for a classifier given nesting (parent selection) + Al-Sawarey allow-list.
  function visibleOptions(c: Classifier): ClsOpt[] {
    let opts = c.options;
    if (c.key === 'purpose') {
      const typeSel = selOf('type');
      if (typeSel) opts = opts.filter((o) => o.parentIds.length === 0 || o.parentIds.includes(typeSel));
    } else if (c.key === 'condition') {
      const purpSel = selOf('purpose');
      if (purpSel) opts = opts.filter((o) => o.parentIds.length === 0 || o.parentIds.includes(purpSel));
    }
    if (alsawarey && (c.key === 'type' || c.key === 'purpose')) opts = opts.filter((o) => o.allowedOnAlsawarey);
    return opts;
  }

  // Toggling the channel resets classifier choices so only valid options can be picked.
  function toggleBrokerage(on: boolean) {
    setShowOnBrokerage(on);
    setSelected((prev) => {
      const next = { ...prev };
      for (const c of classifiers) if (c.key === 'type' || c.key === 'purpose' || c.key === 'condition') next[c.id] = '';
      return next;
    });
  }

  const allChosen = classifiers.length > 0 && classifiers.every((c) => selected[c.id]);

  // An attribute applies when, for every classifier it constrains, the chosen option is allowed.
  function applies(a: Attr): boolean {
    const byCls = new Map<string, string[]>();
    for (const oid of a.optionIds) {
      const cid = optCls.get(oid);
      if (!cid) continue;
      const arr = byCls.get(cid) ?? [];
      arr.push(oid);
      byCls.set(cid, arr);
    }
    for (const [cid, allowed] of byCls) {
      const sel = selected[cid];
      if (!sel || !allowed.includes(sel)) return false;
    }
    return true;
  }

  const grouped = useMemo(() => {
    const applicable = attributes.filter(applies);
    return sections
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((s) => ({ section: s, attrs: applicable.filter((a) => a.sectionId === s.id).sort((a, b) => a.order - b.order) }))
      .filter((g) => g.attrs.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attributes, sections, selected, optCls]);

  async function uploadDoc(file: File, attrId: string) {
    setError('');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('kind', 'document');
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.ok) setAttachs((s) => ({ ...s, [attrId]: [...(s[attrId] ?? []), json.attachment as UploadedAttachment] }));
    else setError('failed');
  }

  function buildValues(): ValueInput[] {
    const out: ValueInput[] = [];
    for (const a of attributes) {
      if (!applies(a)) continue;
      const v = vals[a.id];
      if (a.type === 'BOOLEAN') {
        if (v === true) out.push({ attributeId: a.id, bool: true });
      } else if (a.type === 'NUMBER') {
        if (typeof v === 'string' && v.trim() !== '') out.push({ attributeId: a.id, number: Number(v) });
      } else if (a.type === 'SELECT') {
        if (typeof v === 'string' && v) out.push({ attributeId: a.id, optionIds: [v] });
      } else if (a.type === 'MULTI_SELECT') {
        if (Array.isArray(v) && v.length) out.push({ attributeId: a.id, optionIds: v });
      } else if (a.type === 'PHOTOS' || a.type === 'DOCUMENTS') {
        out.push({ attributeId: a.id, attachmentIds: (attachs[a.id] ?? []).map((x) => x.id) });
      } else if (typeof v === 'string' && v.trim() !== '') {
        out.push({ attributeId: a.id, text: v });
      }
    }
    return out;
  }

  function submit(status: 'DRAFT' | 'PENDING') {
    setError('');
    if (!allChosen || !title.trim() || !contactPhone.trim()) {
      setError('failed');
      return;
    }
    const input: ListingInput = {
      id: initial.id,
      typeOptionId: selOf('type'),
      purposeOptionId: selOf('purpose'),
      conditionOptionId: selOf('condition'),
      title,
      description,
      price: price.trim() ? Number(price) : null,
      priceNote,
      contactPhone,
      contactWhatsapp,
      ownerId: ownerId || null,
      ownerName,
      ownerType: ownerType as 'PERSONAL' | 'COMPANY' | 'BROKER' | 'US',
      showOnBrokerage,
      values: buildValues(),
      photoIds: photos.map((p) => p.id),
      status,
    };
    start(async () => {
      const r = await saveListing(input);
      if (r.ok) router.push(staffMode ? '/admin/marketplace/listings' : '/account/listings');
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
    if (a.type === 'DATE')
      return <input type="month" dir="ltr" value={(v as string) ?? ''} onChange={(e) => setVal(a.id, e.target.value)} className={inp} />;
    if (a.type === 'PHOTOS') {
      const list = attachs[a.id] ?? [];
      return (
        <div className="space-y-2">
          {list.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {list.map((p) => (
                <div key={p.id} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.path} alt="" onClick={() => setZoom(p.path)} className="h-16 w-16 cursor-pointer rounded object-cover ring-1 ring-graphite/20" />
                  <button type="button" onClick={() => setAttachs((s) => ({ ...s, [a.id]: list.filter((x) => x.id !== p.id) }))} className="absolute -end-1 -top-1 rounded-full bg-red-600 px-1 text-[10px] text-white">✕</button>
                </div>
              ))}
            </div>
          )}
          <div className="w-44"><ImageAttachment stampCategory="listing" value={null} onChange={(att) => att && setAttachs((s) => ({ ...s, [a.id]: [...(s[a.id] ?? []), att] }))} /></div>
        </div>
      );
    }
    if (a.type === 'DOCUMENTS') {
      const list = attachs[a.id] ?? [];
      return (
        <div className="space-y-2">
          {list.map((p) => (
            <div key={p.id} className="flex items-center gap-2 text-sm">
              <a href={p.path} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">📄 {p.originalName}</a>
              <button type="button" onClick={() => setAttachs((s) => ({ ...s, [a.id]: list.filter((x) => x.id !== p.id) }))} className="text-red-600">✕</button>
            </div>
          ))}
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-graphite/25 px-3 py-1.5 text-xs hover:bg-graphite/10">
            + {t('addDocument')}
            <input type="file" accept=".pdf,.docx,.xlsx" hidden onChange={(e) => { const fl = e.target.files?.[0]; if (fl) void uploadDoc(fl, a.id); e.target.value = ''; }} />
          </label>
        </div>
      );
    }
    return <input value={(v as string) ?? ''} onChange={(e) => setVal(a.id, e.target.value)} className={inp} />;
  }

  return (
    <div className="max-w-3xl space-y-5">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Publish channel (staff): Al Sawarey offerings also show on New Obour and are limited
          to the allowed Types/Purposes; New-Obour-only offerings have no such limit. */}
      {staffMode && (
        <div className="rounded-lg border-2 border-primary/25 bg-primary/5 p-4">
          <label className="flex items-center gap-2 text-sm font-semibold text-primary">
            <input type="checkbox" className="h-4 w-4" checked={showOnBrokerage} onChange={(e) => toggleBrokerage(e.target.checked)} /> {t('publishOnAlsawarey')}
          </label>
          <p className="mt-1 text-xs opacity-60">{alsawarey ? t('alsawareyLimited') : t('newObourOnly')}</p>
        </div>
      )}

      {/* Type → Purpose → Status classifiers (hard nesting) */}
      <div className="grid gap-4 sm:grid-cols-3">
        {classifiers.map((c) => {
          const opts = visibleOptions(c);
          const parentPicked = c.key === 'purpose' ? !!selOf('type') : c.key === 'condition' ? !!selOf('purpose') : true;
          return (
            <label key={c.id} className="block text-sm">
              {L(c.nameAr, c.nameEn)}
              <select value={selected[c.id] ?? ''} onChange={(e) => setSel(c.id, e.target.value)} disabled={!parentPicked} className={inp}>
                <option value="">{parentPicked ? '—' : t('pickParentFirst')}</option>
                {opts.map((o) => (<option key={o.id} value={o.id}>{L(o.nameAr, o.nameEn)}</option>))}
              </select>
            </label>
          );
        })}
      </div>

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
        </div>
      ) : (
        <div className="grid gap-4 rounded-lg border border-graphite/15 p-4 sm:grid-cols-2">
          <label className="text-sm">{t('owner')} — {t('ownerName')}<input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} className={inp} /></label>
          <label className="text-sm">
            {t('ownerType')}
            <select value={ownerType} onChange={(e) => setOwnerType(e.target.value)} className={inp}>
              <option value="PERSONAL">{t('typePERSONAL')}</option>
              <option value="COMPANY">{t('typeCOMPANY')}</option>
              <option value="BROKER">{t('typeBROKER')}</option>
            </select>
          </label>
        </div>
      )}

      {allChosen ? (
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
        ))
      ) : (
        <p className="rounded-lg border border-dashed border-graphite/25 p-4 text-sm opacity-60">{t('pickClassifiers')}</p>
      )}

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
            <ImageAttachment stampCategory="listing" value={null} onChange={(a) => a && setPhotos((prev) => [...prev, a])} />
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
        <a href={staffMode ? '/admin/marketplace/listings' : '/account/listings'} className="px-4 py-2 text-sm opacity-70">{t('cancel')}</a>
      </div>

      {zoom && <Lightbox src={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}
