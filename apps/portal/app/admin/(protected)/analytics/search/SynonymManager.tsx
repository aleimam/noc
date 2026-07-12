'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveSynonym, toggleSynonym, deleteSynonym } from './actions';

export type SynonymRow = {
  id: string;
  terms: string;
  site: string | null;
  surface: string | null;
  note: string | null;
  isActive: boolean;
};

type Draft = { id?: string; terms: string; site: string; surface: string; note: string; isActive: boolean };
const EMPTY: Draft = { terms: '', site: '', surface: '', note: '', isActive: true };

// text-base (16px) — smaller triggers iOS focus-zoom, and admins edit synonyms from phones.
const inp = 'w-full rounded-md border border-graphite/25 bg-transparent px-3 py-2 text-base';

export function SynonymManager({ groups, canManage, locale }: { groups: SynonymRow[]; canManage: boolean; locale: 'ar' | 'en' }) {
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');

  const siteLabel = (s: string | null) => (!s ? L('كل المواقع', 'All sites') : s === 'newobour' ? 'New Obour' : 'Al Sawarey');
  const surfaceLabel = (s: string | null) => (!s ? L('كل المواضع', 'All surfaces') : s === 'market' ? L('السوق', 'Market') : s === 'storefront' ? L('المتجر', 'Storefront') : L('التقنين', 'Rationing'));

  function open(row?: SynonymRow) {
    setError('');
    setDraft(row ? { id: row.id, terms: row.terms, site: row.site ?? '', surface: row.surface ?? '', note: row.note ?? '', isActive: row.isActive } : { ...EMPTY });
  }

  function save() {
    if (!draft) return;
    setError('');
    start(async () => {
      const r = await saveSynonym({ id: draft.id, terms: draft.terms, site: draft.site || null, surface: draft.surface || null, note: draft.note || null, isActive: draft.isActive });
      if (r.ok) { setDraft(null); router.refresh(); }
      else setError(r.error === 'need_two_terms' ? L('أدخل كلمتين مختلفتين على الأقل (كل كلمة في سطر).', 'Enter at least two different terms (one per line).') : L('تعذّر الحفظ', 'Could not save'));
    });
  }

  function remove(id: string) {
    if (!confirm(L('حذف هذه المجموعة؟', 'Delete this group?'))) return;
    start(async () => { await deleteSynonym(id); router.refresh(); });
  }

  function toggle(id: string, isActive: boolean) {
    start(async () => { await toggleSynonym(id, isActive); router.refresh(); });
  }

  return (
    <div className="rounded-lg border border-graphite/15 p-4">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-primary">{L('قاموس المرادفات', 'Synonym dictionary')}</h3>
        {canManage && !draft && (
          <button onClick={() => open()} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-soft">+ {L('مجموعة جديدة', 'New group')}</button>
        )}
      </div>
      <p className="mb-3 text-xs opacity-60">
        {L(
          'كل مجموعة = كلمات يعاملها البحث كمترادفة (كل كلمة في سطر). مثال: «فيلا / فيله / villa». يُطبَّق على بحث السوق والمتجر.',
          'Each group = words the search treats as equivalent (one per line), e.g. "villa / فيلا / فيله". Applied to the market + storefront search.',
        )}
      </p>

      {/* Editor */}
      {draft && (
        <div className="mb-4 space-y-2 rounded-lg border border-primary/25 bg-primary/5 p-3">
          <textarea
            value={draft.terms}
            onChange={(e) => setDraft({ ...draft, terms: e.target.value })}
            rows={4}
            placeholder={L('كلمة في كل سطر…', 'One term per line…')}
            className={inp}
            dir="auto"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs">
              <span className="mb-0.5 block opacity-70">{L('الموقع', 'Site')}</span>
              <select value={draft.site} onChange={(e) => setDraft({ ...draft, site: e.target.value })} className={inp}>
                <option value="">{L('كل المواقع', 'All sites')}</option>
                <option value="newobour">New Obour</option>
                <option value="alsawarey">Al Sawarey</option>
              </select>
            </label>
            <label className="text-xs">
              <span className="mb-0.5 block opacity-70">{L('الموضع', 'Surface')}</span>
              <select value={draft.surface} onChange={(e) => setDraft({ ...draft, surface: e.target.value })} className={inp}>
                <option value="">{L('كل المواضع', 'All surfaces')}</option>
                <option value="market">{L('السوق', 'Market')}</option>
                <option value="storefront">{L('المتجر', 'Storefront')}</option>
              </select>
            </label>
          </div>
          <input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder={L('ملاحظة (اختياري)', 'Note (optional)')} className={inp} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} /> {L('مُفعّل', 'Active')}</label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={save} disabled={pending} className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-soft disabled:opacity-50">{L('حفظ', 'Save')}</button>
            <button onClick={() => { setDraft(null); setError(''); }} className="rounded-lg border border-graphite/25 px-4 py-1.5 text-sm">{L('إلغاء', 'Cancel')}</button>
          </div>
        </div>
      )}

      {/* List */}
      {groups.length === 0 ? (
        <p className="text-xs opacity-50">{L('لا توجد مجموعات بعد.', 'No groups yet.')}</p>
      ) : (
        <div className="space-y-2">
          {groups.map((g) => {
            const words = g.terms.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
            return (
              <div key={g.id} className={`rounded-lg border border-graphite/15 p-3 ${g.isActive ? '' : 'opacity-50'}`}>
                <div className="flex flex-wrap items-center gap-1.5">
                  {words.map((w, i) => (
                    <span key={i} className="rounded-full bg-graphite/10 px-2.5 py-0.5 text-sm" dir="auto">{w}</span>
                  ))}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs opacity-70">
                  <span className="rounded bg-graphite/10 px-2 py-0.5">{siteLabel(g.site)}</span>
                  <span className="rounded bg-graphite/10 px-2 py-0.5">{surfaceLabel(g.surface)}</span>
                  {g.note && <span className="italic">“{g.note}”</span>}
                  {!g.isActive && <span className="font-semibold text-graphite/60">{L('غير مُفعّل', 'inactive')}</span>}
                  {canManage && (
                    /* real touch targets (~40px) — this editor is used from phones */
                    <span className="ms-auto flex flex-wrap items-center gap-1.5 text-sm">
                      <button onClick={() => toggle(g.id, !g.isActive)} disabled={pending} className="min-h-[40px] rounded-lg border border-graphite/25 px-3 py-1.5 font-semibold text-accent hover:bg-graphite/10">{g.isActive ? L('إيقاف', 'Disable') : L('تفعيل', 'Enable')}</button>
                      <button onClick={() => open(g)} disabled={pending} className="min-h-[40px] rounded-lg border border-graphite/25 px-3 py-1.5 font-semibold text-accent hover:bg-graphite/10">{L('تعديل', 'Edit')}</button>
                      <button onClick={() => remove(g.id)} disabled={pending} className="min-h-[40px] rounded-lg px-3 py-1.5 font-semibold text-red-600 hover:bg-red-600/10">{L('حذف', 'Delete')}</button>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
