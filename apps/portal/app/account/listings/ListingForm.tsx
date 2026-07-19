'use client';

import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ImageAttachment, Lightbox, toast, type UploadedAttachment } from '@noc/ui';
import { localizeUnit } from '@noc/i18n';
import { roundToStandardArea, formatMoneyThousands, formatMoneyEgp, formatArea, isValidPhone, REQUIRED_LISTING_ATTR_KEYS } from '@noc/config';
import { reconcile, type CalculatorConfig } from '../../../lib/calculator/calc';
import { RichEditor } from '../../admin/(protected)/pages/RichEditor';
import { setAreaMap } from '../../admin/(protected)/lands/actions';
import type { Shape } from '../../admin/(protected)/lands/MapAnnotator';
import { saveListing, type ListingInput, type ValueInput } from './actions';

// react-konva touches the DOM/canvas at import — load the annotator client-only.
const MapAnnotator = dynamic(() => import('../../admin/(protected)/lands/MapAnnotator').then((m) => m.MapAnnotator), { ssr: false });

type AttrType =
  | 'TEXT' | 'TEXTAREA' | 'NUMBER' | 'BOOLEAN' | 'SELECT' | 'MULTI_SELECT' | 'DATE' | 'PHOTOS' | 'DOCUMENTS'
  | 'URL' | 'PHONE' | 'DATE_FULL' | 'MONEY' | 'MONEY_THOUSANDS' | 'AREA_ORIGINAL' | 'AREA_ALLOCATED' | 'YESNO'
  | 'DISTRICT' | 'NEIGHBORHOOD';
type AttrCfg = { yesLabelAr?: string; yesLabelEn?: string; noLabelAr?: string; noLabelEn?: string; multiple?: boolean };
type Opt = { id: string; labelAr: string; labelEn: string; districtId?: string };
type Attr = { id: string; key: string; sectionId: string; labelAr: string; labelEn: string; type: AttrType; unit: string | null; config?: AttrCfg; order: number; options: Opt[]; optionIds: string[]; required?: boolean };

const REQUIRED_ATTR_KEYS = new Set<string>(REQUIRED_LISTING_ATTR_KEYS);

// «مستحقات جهاز المدينة» auto-fill: these attribute keys map 1:1 onto the reconciliation
// calculator's outputs (see autoCalcAuthorityFees). Input = «أصل المساحة» (original_area);
// «المساحة» (area) is used as the received standard when present.
const AUTHORITY_FEE_KEYS = new Set(['ownership_fees', 'remaining_fees', 'first_annual', 'second_annual', 'third_annual']);

const NUMERIC_TYPES = new Set(['NUMBER', 'MONEY', 'MONEY_THOUSANDS', 'AREA_ORIGINAL', 'AREA_ALLOCATED']);
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
  area: string;
  price: string;
  priceUnit: 'TOTAL' | 'UNIT' | 'SQM';
  priceNegotiable: boolean;
  priceNote: string;
  lowestPrice: string; // internal floor — admins & owner only, never public
  /** Current listing status (edit pages). Auto-save runs only for new forms and DRAFTs —
   *  it must never silently pull a PENDING/PUBLISHED listing back to draft. */
  status?: string;
  isPartnership?: boolean;
  partnershipType?: string;
  partnershipNote?: string;
  // Official papers (internal) — staff edit; partners see only the two booleans.
  hasAllocationLetter?: boolean;
  allocationLetterDate?: string;
  allocationPhoto?: UploadedAttachment | null;
  hasSaleMandate?: boolean;
  saleMandateDate?: string;
  saleMandatePhoto?: UploadedAttachment | null;
  contactPhone: string;
  contactWhatsapp: boolean;
  ownerId: string;
  ownerName: string;
  ownerType: string;
  showOnBrokerage: boolean;
  vals: Record<string, string | boolean | string[]>;
  photos: UploadedAttachment[];
  attachs: Record<string, UploadedAttachment[]>;
  buildingConditionIds?: string[];
};

// text-base (16px) — anything smaller triggers iOS focus-zoom on the whole page.
const inp = 'w-full rounded-md border border-graphite/20 bg-transparent px-3 py-2 text-base';

export function ListingForm({
  classifiers,
  sections,
  attributes,
  initial,
  locale,
  staffMode = false,
  partnerMode = false,
  owners = [],
  standardAreas = [],
  buildingConditions = [],
  returnTo,
  nbMasterplans = {},
  locationAnnotation = null,
  savedNeighborhoodId = null,
  partnershipsEnabled = true,
  alsawareyDefaults = null,
  calcConfig = null,
}: {
  classifiers: Classifier[];
  sections: Section[];
  attributes: Attr[];
  initial: ListingFormInitial;
  locale: 'ar' | 'en';
  staffMode?: boolean;
  partnerMode?: boolean; // owner fixed to the partner's own record; staff-only fields hidden
  partnershipsEnabled?: boolean; // when false the partnership opt-in block is hidden
  owners?: OwnerOpt[];
  standardAreas?: number[];
  buildingConditions?: { id: string; unitLabelAr: string; unitLabelEn: string }[];
  returnTo?: string;
  /** neighborhoodId → masterplan cleanPath, for the in-form location-map annotator (staff). */
  nbMasterplans?: Record<string, string>;
  /** Saved location-map shapes (edit page), reused when the same neighborhood stays selected. */
  locationAnnotation?: Shape[] | null;
  savedNeighborhoodId?: string | null;
  /** Standard Al Sawarey classifier trio (Type/Purpose/Condition option ids) — pre-selected when
   *  staff turn the Al Sawarey channel ON on a fresh form. See loadAlsawareyDefaults(). */
  alsawareyDefaults?: { typeOptionId: string; purposeOptionId: string; conditionOptionId: string } | null;
  /** Live حاسبة التصالح config — enables the «احسب تلقائيًا» button on مستحقات جهاز المدينة. */
  calcConfig?: CalculatorConfig | null;
}) {
  const t = useTranslations('mp');
  const tc = useTranslations('common');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState<string | null>(null);
  // «تفاصيل أخرى + صور أخرى» is optional, so it sits collapsed at the bottom (owner request).
  // Closed by default; its contents mount only when open — TipTap misbehaves if mounted hidden,
  // and the text/photos live in parent state so collapsing never loses anything.
  const [extrasOpen, setExtrasOpen] = useState(false);

  // ── Auto-save as draft (new forms + existing DRAFTs only) ──────────────────────────
  // Every 15s the form serializes itself; if anything changed since the last save AND the
  // server-side minimum is met (classifiers + title + valid phone), it saves as DRAFT.
  // The first auto-save CREATES the listing — its id is adopted so every later save
  // (auto or the manual buttons) updates that same row, never a duplicate.
  const draftIdRef = useRef(initial.id ?? '');
  const autosaveOn = !initial.id || initial.status === 'DRAFT';
  const submittedRef = useRef(false); // manual submit succeeded → stop auto-saving
  const autosavingRef = useRef(false);
  const pendingRef = useRef(false);
  const lastSnapRef = useRef('');
  const buildInputRef = useRef<(() => ListingInput) | null>(null);
  const [draftState, setDraftState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [draftSavedAt, setDraftSavedAt] = useState('');
  pendingRef.current = pending;

  useEffect(() => {
    if (!autosaveOn) return;
    // Editing an existing draft: seed the snapshot so an untouched form never re-saves.
    if (draftIdRef.current && buildInputRef.current) {
      try { lastSnapRef.current = JSON.stringify(buildInputRef.current()); } catch { /* ignore */ }
    }
    const tick = async () => {
      if (submittedRef.current || autosavingRef.current || pendingRef.current) return;
      const build = buildInputRef.current;
      if (!build) return;
      const input = build();
      // Below the server-side minimum → wait (the hint under the buttons explains this).
      if (!input.typeOptionId || !input.purposeOptionId || !input.conditionOptionId) return;
      if (!input.title.trim() || !input.contactPhone.trim() || !isValidPhone(input.contactPhone)) return;
      const snap = JSON.stringify(input);
      if (snap === lastSnapRef.current) return;
      autosavingRef.current = true;
      setDraftState('saving');
      try {
        const r = await saveListing(input);
        if (r.ok) {
          lastSnapRef.current = snap;
          if (!draftIdRef.current) {
            draftIdRef.current = r.id;
            // Reload-safe: silently swap the /new URL for the draft's edit page (no remount).
            if (!partnerMode) {
              const base = staffMode ? '/admin/marketplace/listings' : '/account/listings';
              try { window.history.replaceState(null, '', `${base}/${r.id}/edit`); } catch { /* ignore */ }
            }
          }
          setDraftSavedAt(new Date().toLocaleTimeString(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { hour: '2-digit', minute: '2-digit' }));
          setDraftState('saved');
        } else {
          setDraftState('idle'); // silent — the manual buttons surface real errors
        }
      } catch {
        setDraftState('idle');
      } finally {
        autosavingRef.current = false;
      }
    };
    const timer = setInterval(tick, 15000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autosaveOn]);
  // The submit buttons live at the bottom of a long form — scroll the error into view so
  // a failed validation never goes unnoticed.
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [error]);

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
  // The editor stores HTML, so "empty" arrives as '' or '<p></p>' — strip tags/spaces before
  // deciding whether to flag real content on the collapsed «تفاصيل أخرى» header.
  const hasDescription = description.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().length > 0;
  // Legacy Listing.area passthrough — the visible input moved to the Area attribute group.
  const [area] = useState(initial.area);
  const [price, setPrice] = useState(initial.price);
  const [priceUnit, setPriceUnit] = useState(initial.priceUnit);
  const [priceNegotiable, setPriceNegotiable] = useState(initial.priceNegotiable);
  const [priceNote, setPriceNote] = useState(initial.priceNote);
  const [lowestPrice, setLowestPrice] = useState(initial.lowestPrice);
  const [isPartnership, setIsPartnership] = useState(initial.isPartnership ?? false);
  const [partnershipType, setPartnershipType] = useState(initial.partnershipType ?? '');
  const [partnershipNote, setPartnershipNote] = useState(initial.partnershipNote ?? '');
  // Official papers (internal) — جواب التحصيص + توكيل بيع.
  const [hasAllocation, setHasAllocation] = useState(initial.hasAllocationLetter ?? false);
  const [allocationDate, setAllocationDate] = useState(initial.allocationLetterDate ?? '');
  const [allocationPhoto, setAllocationPhoto] = useState<UploadedAttachment | null>(initial.allocationPhoto ?? null);
  const [hasMandate, setHasMandate] = useState(initial.hasSaleMandate ?? false);
  const [mandateDate, setMandateDate] = useState(initial.saleMandateDate ?? '');
  const [mandatePhoto, setMandatePhoto] = useState<UploadedAttachment | null>(initial.saleMandatePhoto ?? null);
  const [contactPhone, setContactPhone] = useState(initial.contactPhone);
  const [contactWhatsapp, setContactWhatsapp] = useState(initial.contactWhatsapp);
  const [ownerId, setOwnerId] = useState(initial.ownerId);
  const [ownerName, setOwnerName] = useState(initial.ownerName);
  const [ownerType, setOwnerType] = useState(initial.ownerType || 'PERSONAL');
  const [showOnBrokerage, setShowOnBrokerage] = useState(initial.showOnBrokerage);
  const [vals, setVals] = useState<Record<string, string | boolean | string[]>>(initial.vals);
  const [photos, setPhotos] = useState<UploadedAttachment[]>(initial.photos);
  const [attachs, setAttachs] = useState<Record<string, UploadedAttachment[]>>(initial.attachs);
  const [condIds, setCondIds] = useState<string[]>(initial.buildingConditionIds ?? []);

  // ── In-form location map (staff): annotate the selected neighborhood's masterplan;
  //    the result is stored with the listing on save (works on create, before an id exists).
  const nbAttr = useMemo(() => attributes.find((a) => a.type === 'NEIGHBORHOOD'), [attributes]);
  const nbId = nbAttr && typeof vals[nbAttr.id] === 'string' ? (vals[nbAttr.id] as string) : '';
  const nbMasterplan = nbId ? nbMasterplans[nbId] ?? null : null;
  const [annotating, setAnnotating] = useState(false);
  const [pendingMap, setPendingMap] = useState<{ attachmentId: string; shapes: Shape[]; src: string; nbId: string } | null>(null);
  const pendingValid = !!pendingMap && pendingMap.nbId === nbId; // discard if the neighborhood changed after drawing

  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  // Ids of required details left empty at the last publish attempt — highlighted red on the form.
  const [missingAttrIds, setMissingAttrIds] = useState<Set<string>>(new Set());
  const setVal = (id: string, v: string | boolean | string[]) => {
    setVals((p) => ({ ...p, [id]: v }));
    // Clear the red highlight for a field the moment it gets a value.
    setMissingAttrIds((m) => { if (!m.has(id)) return m; const n = new Set(m); n.delete(id); return n; });
  };

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
  // Turning it ON on a FRESH form (nothing chosen yet) pre-selects the standard Al Sawarey trio
  // (Type «أرض - تم التخصيص» / Purpose «عمارة سكني» / الحالة «جاري ترفيق الحي») — staff can still
  // change them. A form with choices keeps the old clear-all behavior so we never silently
  // relabel an existing selection.
  function toggleBrokerage(on: boolean) {
    setShowOnBrokerage(on);
    setSelected((prev) => {
      const next = { ...prev };
      const untouched = (['type', 'purpose', 'condition'] as const).every((k) => {
        const c = clsByKey.get(k);
        return !c || !prev[c.id];
      });
      for (const c of classifiers) {
        if (c.key !== 'type' && c.key !== 'purpose' && c.key !== 'condition') continue;
        let v = '';
        if (on && untouched && alsawareyDefaults) {
          const want =
            c.key === 'type' ? alsawareyDefaults.typeOptionId : c.key === 'purpose' ? alsawareyDefaults.purposeOptionId : alsawareyDefaults.conditionOptionId;
          const opt = c.options.find((o) => o.id === want);
          // Type/Purpose must be on the Al Sawarey allow-list; Condition has no allow-list.
          if (opt && (c.key === 'condition' || opt.allowedOnAlsawarey)) v = opt.id;
        }
        next[c.id] = v;
      }
      return next;
    });
  }

  const allChosen = classifiers.length > 0 && classifiers.every((c) => selected[c.id]);

  // An attribute applies ONLY when explicitly linked: it must be linked to at least one
  // classifier option, and for every classifier it constrains, the chosen option must be
  // among its links. An attribute with no links is hidden everywhere (not yet curated) —
  // "no links = show for all" made every attribute appear on every category.
  function applies(a: Attr): boolean {
    if (a.optionIds.length === 0) return false;
    const byCls = new Map<string, string[]>();
    for (const oid of a.optionIds) {
      const cid = optCls.get(oid);
      if (!cid) continue;
      const arr = byCls.get(cid) ?? [];
      arr.push(oid);
      byCls.set(cid, arr);
    }
    if (byCls.size === 0) return false; // links point at deleted/unknown options
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

  // Required details: the admin-set DB flag (attr.required) is the source of truth; the hard-coded
  // REQUIRED_LISTING_ATTR_KEYS (city) is kept as a defensive fallback. A single-option required
  // SELECT auto-selects its one choice so a locked field (one city) never blocks save.
  // PHOTOS/DOCUMENTS can never be required — they save as attachments, invisible to the
  // value checks here and on the server (a required one would block publishing forever).
  const isRequiredAttr = (a: Attr) =>
    a.type !== 'PHOTOS' && a.type !== 'DOCUMENTS' && (!!a.required || REQUIRED_ATTR_KEYS.has(a.key));
  useEffect(() => {
    for (const a of attributes) {
      if (!isRequiredAttr(a) || a.type !== 'SELECT' || !applies(a)) continue;
      const cur = vals[a.id];
      if ((typeof cur !== 'string' || !cur) && a.options.length === 1) setVal(a.id, a.options[0]!.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attributes, selected, vals]);

  // Keyword-rich saved filename for listing photos (image SEO): type + district + neighborhood
  // + city + title. The upload route slugifies (Arabic-safe) and caps at ~60 chars.
  const photoNameHint = useMemo(() => {
    const optName = (a?: Attr) => {
      if (!a) return '';
      const v = vals[a.id];
      if (typeof v !== 'string' || !v) return '';
      const o = a.options.find((x) => x.id === v);
      return o ? L(o.labelAr, o.labelEn) : '';
    };
    const typeC = clsByKey.get('type');
    const typeOpt = typeC?.options.find((o) => o.id === (typeC ? selected[typeC.id] : ''));
    const parts = [
      typeOpt ? L(typeOpt.nameAr, typeOpt.nameEn) : '',
      optName(attributes.find((a) => a.type === 'DISTRICT' && applies(a))),
      optName(attributes.find((a) => a.type === 'NEIGHBORHOOD' && applies(a))),
      optName(attributes.find((a) => a.key === 'city' && applies(a))),
      title.trim(),
    ].filter(Boolean);
    return parts.join(' ').trim();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attributes, selected, vals, title, locale]);

  async function uploadDoc(file: File, attrId: string) {
    setError('');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('kind', 'document');
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.ok) setAttachs((s) => ({ ...s, [attrId]: [...(s[attrId] ?? []), json.attachment as UploadedAttachment] }));
    else setError(tc('uploadFailed'));
  }

  function buildValues(): ValueInput[] {
    const out: ValueInput[] = [];
    for (const a of attributes) {
      if (!applies(a)) continue;
      const v = vals[a.id];
      if (a.type === 'BOOLEAN' || a.type === 'YESNO') {
        if (typeof v === 'boolean') out.push({ attributeId: a.id, bool: v });
      } else if (NUMERIC_TYPES.has(a.type)) {
        if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) out.push({ attributeId: a.id, number: Number(v) });
      } else if (a.type === 'SELECT') {
        if (typeof v === 'string' && v) out.push({ attributeId: a.id, listItemIds: [v] });
      } else if (a.type === 'MULTI_SELECT') {
        if (Array.isArray(v) && v.length) out.push({ attributeId: a.id, listItemIds: v });
      } else if (a.type === 'PHOTOS' || a.type === 'DOCUMENTS') {
        out.push({ attributeId: a.id, attachmentIds: (attachs[a.id] ?? []).map((x) => x.id) });
      } else if (typeof v === 'string' && v.trim() !== '') {
        out.push({ attributeId: a.id, text: v });
      }
    }
    return out;
  }

  // Single source for the save payload — shared by the manual buttons AND auto-save, so
  // both always carry the same id (an auto-created draft is updated, never duplicated).
  function buildInput(status: 'DRAFT' | 'PENDING'): ListingInput {
    return {
      id: draftIdRef.current || undefined,
      typeOptionId: selOf('type'),
      purposeOptionId: selOf('purpose'),
      conditionOptionId: selOf('condition'),
      title,
      description,
      area: area.trim() ? Number(area) : null,
      price: price.trim() ? Number(price) : null,
      priceUnit,
      priceNegotiable,
      priceNote,
      lowestPrice: lowestPrice.trim() ? Number(lowestPrice) : null,
      isPartnership,
      partnershipType: isPartnership ? partnershipType || null : null,
      partnershipNote: isPartnership ? partnershipNote : '',
      // Official papers (internal) — only staff writes persist server-side.
      hasAllocationLetter: hasAllocation,
      allocationLetterDate: hasAllocation ? allocationDate || null : null,
      allocationPhotoId: hasAllocation ? allocationPhoto?.id ?? null : null,
      hasSaleMandate: hasMandate,
      saleMandateDate: hasMandate ? mandateDate || null : null,
      saleMandatePhotoId: hasMandate ? mandatePhoto?.id ?? null : null,
      contactPhone,
      contactWhatsapp,
      ownerId: ownerId || null,
      ownerName,
      ownerType: ownerType as 'PERSONAL' | 'COMPANY' | 'BROKER' | 'US',
      showOnBrokerage,
      values: buildValues(),
      photoIds: photos.map((p) => p.id),
      buildingConditionIds: condIds,
      status,
    };
  }
  buildInputRef.current = () => buildInput('DRAFT');

  function submit(status: 'DRAFT' | 'PENDING') {
    setError('');
    if (!allChosen || !title.trim() || !contactPhone.trim()) {
      setError(tc('fillRequired'));
      return;
    }
    if (!isValidPhone(contactPhone)) { setError(tc('phoneInvalid')); return; }
    // Mandatory basic details (e.g. the city) must be filled before PUBLISHING —
    // a rough DRAFT may stay incomplete (matches the server-side guard).
    if (status === 'PENDING') {
      const missingList = attributes.filter((a) => {
        if (!isRequiredAttr(a) || !applies(a)) return false;
        const v = vals[a.id];
        // A boolean is an ANSWER either way — «لا» (false) on a required YESNO must pass.
        return Array.isArray(v) ? v.length === 0 : typeof v === 'string' ? !v.trim() : typeof v === 'boolean' ? false : !v;
      });
      if (missingList.length) {
        setMissingAttrIds(new Set(missingList.map((a) => a.id)));
        setError(`${tc('fillRequired')} — ${missingList.map((a) => L(a.labelAr, a.labelEn)).join('، ')}`);
        // Bring the first highlighted field into view.
        if (typeof document !== 'undefined') {
          setTimeout(() => document.getElementById(`attr-${missingList[0]!.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
        }
        return;
      }
      setMissingAttrIds(new Set());
    }
    const input = buildInput(status);
    start(async () => {
      const r = await saveListing(input);
      if (r.ok) {
        submittedRef.current = true; // the form is done — no auto-save may fire after this
        draftIdRef.current = r.id;
        // Persist the location map drawn in-form now that the listing id exists.
        if (staffMode && pendingMap && pendingMap.nbId === nbId) {
          try {
            await setAreaMap({ level: 'listing', targetId: r.id, kind: 'location', attachmentId: pendingMap.attachmentId, annotation: pendingMap.shapes, sourcePath: pendingMap.src });
          } catch {
            /* the listing itself saved; the map can be redone from the edit page */
          }
        }
        router.push(returnTo ?? (staffMode ? '/admin/marketplace/listings' : partnerMode ? '/partner' : '/account/listings'));
      } else setError(r.error === 'invalid_phone' ? tc('phoneInvalid') : tc('saveFailed'));
    });
  }

  // Auto-fill «مستحقات جهاز المدينة» from the reconciliation calculator (حاسبة التصالح):
  // reads BOTH «أصل المساحة» (original) and «المساحة» (the ACTUAL area received — used as the
  // standard; owner decision 2026-07-12: never derive it), runs the same pure reconcile() the
  // public /calculator uses, and fills transfer fee / استكمال / the 3 annual installments.
  // Values stay editable — this is a starting point, not a lock.
  function autoCalcAuthorityFees() {
    if (!calcConfig) return;
    setError('');
    const attrByKey = (k: string) => attributes.find((a) => a.key === k && applies(a));
    const origAttr = attrByKey('original_area');
    const orig = origAttr && typeof vals[origAttr.id] === 'string' ? Number(vals[origAttr.id]) : NaN;
    const stdAttr = attrByKey('area');
    const std = stdAttr && typeof vals[stdAttr.id] === 'string' ? Number(vals[stdAttr.id]) : NaN;
    if (!origAttr || !Number.isFinite(orig) || orig <= 0 || !stdAttr || !Number.isFinite(std) || std <= 0) {
      setError(L('أدخل «أصل المساحة» و«المساحة» أولًا حتى تعمل حاسبة التصالح', 'Enter the original area and the actual area first so the reconciliation calculator can run'));
      return;
    }
    const r = reconcile(orig, std, calcConfig);
    if (r.overMax) {
      setError(L(`المساحة أكبر من الحد الأقصى للحاسبة (${r.maxArea} م²) — تواصل مع الجهاز مباشرة`, `Area exceeds the calculator maximum (${r.maxArea} m²)`));
      return;
    }
    const fill: Record<string, number> = {
      ownership_fees: r.transferFee,
      remaining_fees: r.estekmal,
      first_annual: r.installments[0],
      second_annual: r.installments[1],
      third_annual: r.installments[2],
    };
    setVals((prev) => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(fill)) {
        const a = attrByKey(k);
        if (a) next[a.id] = String(v);
      }
      return next;
    });
    toast(L('تم حساب المستحقات من حاسبة التصالح — راجع القيم قبل الحفظ', 'Dues calculated from the reconciliation calculator — review before saving'));
  }

  // Compose a title from the chosen categories + first Area detail with a value + price.
  function autoTitle() {
    const parts: string[] = [];
    for (const key of ['type', 'purpose', 'condition']) {
      const c = clsByKey.get(key);
      const o = c?.options.find((x) => x.id === (c ? selected[c.id] : ''));
      if (o) parts.push(L(o.nameAr, o.nameEn));
    }
    const areaAttr = attributes.find(
      (a) => (a.type === 'AREA_ALLOCATED' || a.type === 'AREA_ORIGINAL') && applies(a) && typeof vals[a.id] === 'string' && (vals[a.id] as string).trim() !== '',
    );
    if (areaAttr) {
      const n = Number(vals[areaAttr.id]);
      if (!Number.isNaN(n)) parts.push(areaAttr.type === 'AREA_ALLOCATED' ? formatArea(roundToStandardArea(n, standardAreas), locale) : formatArea(n, locale));
    }
    const p = price.trim() ? Number(price) : null;
    if (p != null && !Number.isNaN(p)) parts.push(`${L('بسعر', 'for')} ${formatMoneyEgp(p, locale)}`);
    const composed = parts.join(' ').trim();
    if (composed) setTitle(composed);
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
    if (a.type === 'URL')
      return <input type="url" dir="ltr" inputMode="url" placeholder="https://" value={(v as string) ?? ''} onChange={(e) => setVal(a.id, e.target.value)} className={inp} />;
    if (a.type === 'PHONE')
      return <input type="tel" dir="ltr" inputMode="tel" placeholder="01xxxxxxxxx" value={(v as string) ?? ''} onChange={(e) => setVal(a.id, e.target.value)} className={inp} />;
    if (a.type === 'DATE_FULL')
      return <input type="date" dir="ltr" value={(v as string) ?? ''} onChange={(e) => setVal(a.id, e.target.value)} className={inp} />;
    if (a.type === 'MONEY' || a.type === 'MONEY_THOUSANDS' || a.type === 'AREA_ORIGINAL' || a.type === 'AREA_ALLOCATED') {
      const num = typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)) ? Number(v) : null;
      const suffix =
        a.type === 'AREA_ORIGINAL' || a.type === 'AREA_ALLOCATED' ? (locale === 'ar' ? 'م²' : 'm²') : locale === 'ar' ? 'جنيه' : 'EGP';
      let preview = '';
      if (num != null) {
        if (a.type === 'MONEY_THOUSANDS') preview = `≈ ${formatMoneyThousands(num, locale)}`;
        else if (a.type === 'AREA_ALLOCATED') preview = `≈ ${roundToStandardArea(num, standardAreas)} ${suffix}`;
      }
      return (
        <div>
          <div className="flex items-center gap-2">
            <input type="number" inputMode="numeric" value={(v as string) ?? ''} onChange={(e) => setVal(a.id, e.target.value)} className={inp} />
            <span className="text-xs opacity-60">{suffix}</span>
          </div>
          {preview && <p className="mt-1 text-xs text-accent">{preview}</p>}
        </div>
      );
    }
    if (a.type === 'YESNO') {
      const cfg = a.config ?? {};
      const yes = L(cfg.yesLabelAr || 'نعم', cfg.yesLabelEn || 'Yes');
      const no = L(cfg.noLabelAr || 'لا', cfg.noLabelEn || 'No');
      const btn = (on: boolean, label: string) => (
        <button
          type="button"
          onClick={() => setVal(a.id, on)}
          className={`rounded-lg px-4 py-1.5 text-sm font-semibold ${v === on ? 'bg-primary text-soft' : 'border border-graphite/25'}`}
        >
          {label}
        </button>
      );
      return <div className="flex gap-2">{btn(true, yes)}{btn(false, no)}</div>;
    }
    if (a.type === 'DISTRICT')
      return (
        <select
          value={(v as string) ?? ''}
          onChange={(e) => {
            const districtId = e.target.value;
            setVal(a.id, districtId);
            // Clear any NEIGHBORHOOD choice that no longer belongs to the chosen district.
            for (const nb of attributes) {
              if (nb.type !== 'NEIGHBORHOOD') continue;
              const cur = vals[nb.id];
              if (typeof cur === 'string' && cur && !nb.options.some((o) => o.id === cur && o.districtId === districtId)) setVal(nb.id, '');
            }
          }}
          className={inp}
        >
          <option value="">—</option>
          {a.options.map((o) => (<option key={o.id} value={o.id}>{L(o.labelAr, o.labelEn)}</option>))}
        </select>
      );
    if (a.type === 'NEIGHBORHOOD') {
      // Nested under DISTRICT: filter by the district chosen in the same form (if any).
      const districtAttr = attributes.find((x) => x.type === 'DISTRICT' && applies(x));
      const chosenDistrict = districtAttr && typeof vals[districtAttr.id] === 'string' ? (vals[districtAttr.id] as string) : '';
      const opts = chosenDistrict ? a.options.filter((o) => o.districtId === chosenDistrict) : a.options;
      return (
        <div>
          <select value={(v as string) ?? ''} onChange={(e) => setVal(a.id, e.target.value)} className={inp}>
            <option value="">—</option>
            {opts.map((o) => (<option key={o.id} value={o.id}>{L(o.labelAr, o.labelEn)}</option>))}
          </select>
          {districtAttr && !chosenDistrict && (
            <p className="mt-1 text-xs opacity-60">{L('اختر المنطقة أولاً لتصفية المجاورات', 'Choose the district first to filter neighborhoods')}</p>
          )}
        </div>
      );
    }
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

  // Official-papers editor row (staff): a have/not-yet switch + a date + a single photo.
  const paperRow = (
    label: string,
    has: boolean, setHas: (v: boolean) => void,
    date: string, setDate: (v: string) => void,
    photo: UploadedAttachment | null, setPhoto: (a: UploadedAttachment | null) => void,
  ) => (
    <div className="space-y-2 rounded-lg border border-graphite/15 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold">{label}</span>
        <div className="flex gap-1.5">
          <button type="button" onClick={() => setHas(true)} className={`rounded-lg px-3 py-1 text-sm font-semibold ${has ? 'bg-green text-white' : 'border border-graphite/25'}`}>{L('متوفر', 'Have it')}</button>
          <button type="button" onClick={() => setHas(false)} className={`rounded-lg px-3 py-1 text-sm font-semibold ${!has ? 'bg-primary text-soft' : 'border border-graphite/25'}`}>{L('غير متوفر', 'Not yet')}</button>
        </div>
      </div>
      {has && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block opacity-80">{L('تاريخ الحصول عليه', 'Date obtained')}</span>
            <input type="date" dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} className={inp} />
          </label>
          <div className="text-sm">
            <span className="mb-1 block opacity-80">{L('صورة المستند', 'Document photo')}</span>
            <ImageAttachment stampCategory="listing" value={photo} onChange={(a) => setPhoto(a)} />
          </div>
        </div>
      )}
    </div>
  );
  // Read-only status badge (partner view).
  const paperBadge = (label: string, has: boolean) => (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-graphite/15 px-3 py-2">
      <span className="text-sm font-semibold">{label}</span>
      <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${has ? 'bg-green/15 text-green' : 'bg-graphite/10 text-graphite/60'}`}>
        {has ? L('متوفر', 'Available') : L('غير متوفر', 'Not available')}
      </span>
    </div>
  );

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

      {/* Optional: attach building-conditions ("اشتراطات البناء") pages to this listing. */}
      {buildingConditions.length > 0 && (
        <section className="space-y-2 rounded-lg border border-graphite/15 p-4">
          <h3 className="font-bold text-primary">{L('اشتراطات البناء (اختياري)', 'Building conditions (optional)')}</h3>
          <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {buildingConditions.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={condIds.includes(c.id)}
                  onChange={() => setCondIds((s) => (s.includes(c.id) ? s.filter((x) => x !== c.id) : [...s, c.id]))}
                />
                {L(c.unitLabelAr, c.unitLabelEn)}
              </label>
            ))}
          </div>
        </section>
      )}

      {/* ── Basic details (shown for every listing) ── */}
      <section className="space-y-4 rounded-lg border border-graphite/15 p-4">
        <h3 className="font-bold text-primary">{t('basicDetails')}</h3>

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

        {/* ── Category-gated details — moved in from the old «تفاصيل إضافية» section so they sit
             directly after the types and before the price (owner request 2026-07-17). Each group
             keeps its own heading («المساحات» …). Filling the area here first also makes the
             ✨ auto-title button produce a better title. ── */}
        {allChosen && grouped.length === 0 && (
          <p className="rounded-lg border border-graphite/15 p-4 text-sm opacity-70">
            {t('noAttrsForCategory')}
            {staffMode && (
              <>
                {' '}{t('noAttrsForCategoryStaff')}{' '}
                <a href="/admin/marketplace/category-attributes" className="text-accent underline">{t('categoryAttrs')}</a>
              </>
            )}
          </p>
        )}
        {allChosen ? (
          grouped.map((g) => (
            <Fragment key={g.section.id}>
              <div className="space-y-3 rounded-lg border border-graphite/15 p-4">
                <h4 className="font-semibold text-primary">{L(g.section.nameAr, g.section.nameEn)}</h4>
                {/* «مستحقات جهاز المدينة»: one-tap auto-fill from the reconciliation calculator. */}
                {calcConfig && g.attrs.some((a) => AUTHORITY_FEE_KEYS.has(a.key)) && (
                  <div className="rounded-lg border border-gold-300/60 bg-gold/10 p-3">
                    <button
                      type="button"
                      onClick={autoCalcAuthorityFees}
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-soft hover:brightness-110"
                    >
                      🧮 {L('احسب تلقائيًا من حاسبة التصالح', 'Auto-calculate from the reconciliation calculator')}
                    </button>
                    <p className="mt-1.5 text-xs opacity-70">
                      {L('يعتمد الحساب على «أصل المساحة» و«المساحة» (الفعلية المستلمة). تُملأ القيم ويمكنك تعديلها قبل الحفظ.', 'Uses the original area and the actual received area. Values are filled in and stay editable.')}
                    </p>
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  {g.attrs.map((a) => {
                    const req = isRequiredAttr(a);
                    const miss = missingAttrIds.has(a.id);
                    return (
                      <label key={a.id} id={`attr-${a.id}`} className={`text-sm ${miss ? 'rounded-lg bg-red-50 p-2 ring-2 ring-red-400' : ''}`}>
                        <span className="mb-1 block opacity-80">
                          {/* red ★ marks a required detail; the explicit «مطلوب» word stays for the low-literacy audience */}
                          {req && <span className="font-bold text-red-600" title={L('مطلوب', 'required')}>★ </span>}
                          {L(a.labelAr, a.labelEn)}
                          {req && <span className="font-semibold text-red-600"> ({L('مطلوب', 'required')})</span>}
                        </span>
                        {control(a)}
                        {miss && <span className="mt-1 block text-xs font-semibold text-red-600">{L('هذا الحقل مطلوب', 'This field is required')}</span>}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* ── Listing location map: directly below the الموقع group (the one holding the
                   neighborhood picker) — owner request 2026-07-17. Staff-only, needs a chosen
                   neighborhood; annotates that neighborhood's masterplan. ── */}
              {staffMode && nbId && g.attrs.some((a) => a.type === 'NEIGHBORHOOD') && (
                <section className="space-y-2 rounded-lg border border-graphite/15 p-4">
                  <h3 className="font-bold text-primary">{t('listingLocationMap')}</h3>
                  {nbMasterplan ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setAnnotating(true)}
                        className="rounded-lg border border-accent/40 px-3 py-1.5 text-sm text-accent hover:bg-accent/5"
                      >
                        ✎ {t('genFromNbMasterplan')}
                      </button>
                      {pendingValid && <p className="text-sm text-green">✓ {t('locationMapReady')}</p>}
                      {!pendingValid && savedNeighborhoodId && nbId === savedNeighborhoodId && locationAnnotation && (
                        <p className="text-xs opacity-60">{t('locationMapHasSaved')}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm opacity-60">{t('nbNoMasterplan')}</p>
                  )}
                  {annotating && nbMasterplan && (
                    <MapAnnotator
                      src={nbMasterplan}
                      initialShapes={
                        pendingValid
                          ? pendingMap!.shapes
                          : nbId === savedNeighborhoodId
                            ? locationAnnotation ?? undefined
                            : undefined
                      }
                      onClose={() => setAnnotating(false)}
                      onSaved={(attachmentId, shapes) => {
                        setAnnotating(false);
                        setPendingMap({ attachmentId, shapes, src: nbMasterplan, nbId });
                      }}
                    />
                  )}
                </section>
              )}
            </Fragment>
          ))
        ) : (
          <p className="rounded-lg border border-dashed border-graphite/25 p-4 text-sm opacity-60">{t('pickClassifiers')}</p>
        )}

        {/* Title (+ auto-generate) */}
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-sm">{t('listingTitle')}</span>
            <button type="button" onClick={autoTitle} className="rounded border border-graphite/25 px-2 py-0.5 text-xs hover:bg-graphite/10">✨ {t('autoTitle')}</button>
          </div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inp} />
        </div>

        {/* Price row: السعر · السعر لـ · أقل سعر (internal). Then: ملاحظة على السعر · قابل للتفاوض؟
            — «أقل سعر» and «قابل للتفاوض؟» were swapped on 2026-07-17 (owner request), keeping the
            two money inputs together on the top row. (The area field lives in the Area attribute
            group — the legacy Listing.area column stays untouched on old listings.) */}
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-sm">{t('price')}<input type="number" dir="ltr" value={price} onChange={(e) => setPrice(e.target.value)} className={inp} /></label>
          <label className="text-sm">{t('pricePer')}
            <select value={priceUnit} onChange={(e) => setPriceUnit(e.target.value as 'TOTAL' | 'UNIT' | 'SQM')} className={inp}>
              <option value="TOTAL">{t('priceTotal')}</option>
              <option value="UNIT">{t('pricePerUnit')}</option>
              <option value="SQM">{t('pricePerSqm')}</option>
            </select>
          </label>
          {/* Internal floor / walk-away price — admins & owner only. Never rendered on any public page. */}
          <label className="block text-sm">
            <span className="flex items-center gap-1">🔒 {t('lowestPrice')}</span>
            <input type="number" dir="ltr" value={lowestPrice} onChange={(e) => setLowestPrice(e.target.value)} className={inp} />
            <span className="mt-1 block text-xs opacity-60">{t('lowestPriceHint')}</span>
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">{t('priceNote')}<input value={priceNote} onChange={(e) => setPriceNote(e.target.value)} className={inp} /></label>
          <div className="text-sm">
            <span className="mb-1 block">{t('negotiable')}</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPriceNegotiable(true)} className={`flex-1 rounded-lg px-3 py-2 font-semibold ${priceNegotiable ? 'bg-primary text-soft' : 'border border-graphite/25'}`}>{t('yes')}</button>
              <button type="button" onClick={() => setPriceNegotiable(false)} className={`flex-1 rounded-lg px-3 py-2 font-semibold ${!priceNegotiable ? 'bg-primary text-soft' : 'border border-graphite/25'}`}>{t('no')}</button>
            </div>
          </div>
        </div>

        {/* ── Plot consolidation & partnerships (تجميع الملاك والشراكات) opt-in ── */}
        {partnershipsEnabled && (
        <div className="space-y-3 rounded-lg border border-gold-300/50 bg-gold/10 p-4">
          <div className="text-sm font-bold text-primary">🤝 {t('partnershipQ')}</div>
          <p className="text-xs opacity-70">{t('partnershipHint')}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setIsPartnership(true)} className={`flex-1 rounded-lg px-3 py-2 font-semibold ${isPartnership ? 'bg-primary text-soft' : 'border border-graphite/25'}`}>{t('yes')}</button>
            <button type="button" onClick={() => setIsPartnership(false)} className={`flex-1 rounded-lg px-3 py-2 font-semibold ${!isPartnership ? 'bg-primary text-soft' : 'border border-graphite/25'}`}>{t('no')}</button>
          </div>
          {isPartnership && (
            <>
              <div className="grid gap-2 sm:grid-cols-3">
                {(['CONSOLIDATION', 'JOINT_BUILD', 'SHARE_SALE'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setPartnershipType((cur) => (cur === k ? '' : k))}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold ${partnershipType === k ? 'bg-primary text-soft' : 'border border-graphite/25 hover:bg-graphite/10'}`}
                  >
                    {t(`pt_${k}`)}
                  </button>
                ))}
              </div>
              <label className="block text-sm">
                {t('partnershipNote')}
                <input value={partnershipNote} onChange={(e) => setPartnershipNote(e.target.value)} maxLength={190} placeholder={t('partnershipNotePh')} className={inp} />
              </label>
            </>
          )}
        </div>
        )}

        {/* Owner — partner listings are always owned by the partner's own Owner record. */}
        {partnerMode ? null : staffMode ? (
          <label className="block text-sm">
            {t('owner')}
            <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className={inp}>
              <option value="">{t('none')}</option>
              {owners.map((o) => (<option key={o.id} value={o.id}>{o.name} ({t(`type${o.type}`)})</option>))}
            </select>
          </label>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
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

        {/* «تفاصيل أخرى» + «صور أخرى» used to live here; they now render collapsed at the very
            bottom, just above the save buttons (owner request 2026-07-17). */}
      </section>

      {/* (The listing location-map annotator lives inside the details groups now — right below
           the الموقع group. Keep the papers + contact as the closing blocks of the form.) */}

      {/* ── Official papers (internal): staff edit; partners see the two switches only ──
           Second-to-last by design: papers → contact + actions close every form. ── */}
      {(staffMode || partnerMode) && (
        <section className="space-y-3 rounded-lg border border-graphite/15 p-4">
          <div>
            <h3 className="font-bold text-primary">🗂️ {L('الأوراق الرسمية (داخلي)', 'Official papers (internal)')}</h3>
            <p className="text-xs opacity-60">
              {staffMode
                ? L('لا تظهر هذه الأوراق للعملاء. الشركاء يرون حالة كل ورقة فقط.', "Not shown to customers. Partners see only each paper's status.")
                : L('يديرها فريقنا — تظهر لك حالة كل ورقة فقط.', "Managed by our team — you see each paper's status only.")}
            </p>
          </div>
          {staffMode ? (
            <>
              {paperRow(L('جواب التحصيص', 'Allocation letter'), hasAllocation, setHasAllocation, allocationDate, setAllocationDate, allocationPhoto, setAllocationPhoto)}
              {paperRow(L('توكيل بيع', 'Sale mandate'), hasMandate, setHasMandate, mandateDate, setMandateDate, mandatePhoto, setMandatePhoto)}
            </>
          ) : (
            <div className="space-y-2">
              {paperBadge(L('جواب التحصيص', 'Allocation letter'), initial.hasAllocationLetter ?? false)}
              {paperBadge(L('توكيل بيع', 'Sale mandate'), initial.hasSaleMandate ?? false)}
            </div>
          )}
        </section>
      )}

      {/* ── رقم التواصل ── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">{t('contactPhone')}<input type="tel" dir="ltr" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={inp} /></label>
        <label className="flex items-end gap-2 text-sm"><input type="checkbox" checked={contactWhatsapp} onChange={(e) => setContactWhatsapp(e.target.checked)} /> {t('whatsapp')}</label>
      </div>

      {/* ── «تفاصيل أخرى» + «صور أخرى» — optional, collapsed, the last block before the actions ── */}
      <section className="rounded-lg border border-graphite/15">
        <button
          type="button"
          onClick={() => setExtrasOpen((v) => !v)}
          aria-expanded={extrasOpen}
          className="flex w-full items-center justify-between gap-3 p-4 text-start"
        >
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-primary">📝 {t('otherDetails')} + {t('otherPhotos')}</span>
            {/* Say when something's inside — a low-literacy user must never lose content behind a fold. */}
            {(hasDescription || photos.length > 0) && (
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">
                {photos.length > 0
                  ? L(`يوجد محتوى · ${photos.length} صورة`, `has content · ${photos.length} photo${photos.length === 1 ? '' : 's'}`)
                  : L('يوجد محتوى', 'has content')}
              </span>
            )}
            <span className="text-xs opacity-60">{L('اختياري', 'optional')}</span>
          </span>
          <span className={`shrink-0 text-lg transition-transform ${extrasOpen ? 'rotate-180' : ''}`} aria-hidden="true">▾</span>
        </button>
        {extrasOpen && (
          <div className="space-y-4 border-t border-graphite/10 p-4">
            <div>
              <span className="mb-1 block text-sm">{t('otherDetails')}</span>
              <RichEditor value={description} onChange={setDescription} />
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-semibold">{t('otherPhotos')}</h4>
              <div className="flex flex-wrap gap-3">
                {photos.map((p) => (
                  <div key={p.id} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.path} alt="" onClick={() => setZoom(p.path)} className="h-20 w-20 cursor-pointer rounded-md object-cover ring-1 ring-graphite/20" />
                    <button type="button" onClick={() => setPhotos(photos.filter((x) => x.id !== p.id))} className="absolute -end-1 -top-1 rounded-full bg-red-600 px-1.5 text-xs text-white">✕</button>
                  </div>
                ))}
                <div className="w-48">
                  {/* nameHint → keyword-rich saved filename (image SEO): type + geo (district,
                      neighborhood, city) + title. Empty before anything is picked → route falls
                      back to a uuid. */}
                  <ImageAttachment stampCategory="listing" nameHint={photoNameHint} value={null} onChange={(a) => a && setPhotos((prev) => [...prev, a])} />
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Actions — full-width stacked on phones (golden rule: big, obvious tap targets). */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {error && <p ref={errorRef} className="w-full text-sm font-semibold text-red-600">{error}</p>}
        <button disabled={pending} onClick={() => submit('PENDING')} className="w-full rounded-md bg-primary px-4 py-3 text-base font-bold text-soft disabled:opacity-50 sm:w-auto sm:py-2 sm:text-sm sm:font-normal">{t('submitOffer')}</button>
        <button disabled={pending} onClick={() => submit('DRAFT')} className="w-full rounded-md border border-graphite/25 px-4 py-3 text-base disabled:opacity-50 sm:w-auto sm:py-2 sm:text-sm">{t('saveDraft')}</button>
        <a href={returnTo ?? (staffMode ? '/admin/marketplace/listings' : partnerMode ? '/partner' : '/account/listings')} className="w-full px-4 py-3 text-center text-base opacity-70 sm:w-auto sm:py-2 sm:text-sm">{t('cancel')}</a>
      </div>

      {/* Auto-save status — explicit so no one wonders whether their work is safe. */}
      {autosaveOn && (
        <p className="text-xs opacity-60" aria-live="polite">
          {draftState === 'saving'
            ? `💾 ${L('جارٍ الحفظ التلقائي…', 'Auto-saving…')}`
            : draftState === 'saved'
              ? `✓ ${L('حُفِظ تلقائياً كمسودة', 'Auto-saved as a draft')} — ${draftSavedAt}`
              : `✨ ${L('يُحفَظ تلقائياً كمسودة كل ١٥ ثانية بعد اختيار التصنيفات وكتابة العنوان ورقم التواصل', 'Auto-saves as a draft every 15s once the categories, title and contact phone are filled')}`}
        </p>
      )}

      {zoom && <Lightbox src={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}
