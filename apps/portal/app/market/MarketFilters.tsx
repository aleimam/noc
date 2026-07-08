'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { localizeUnit } from '@noc/i18n';

type Opt = { key: string; labelAr: string; labelEn: string };
type FAttr = { id: string; key: string; labelAr: string; labelEn: string; type: string; unit: string | null; options: Opt[] };
type PType = { key: string; nameAr: string; nameEn: string };

export function MarketFilters({
  types,
  filterAttrs,
  typeKey,
  locale,
}: {
  types: PType[];
  filterAttrs: FAttr[];
  typeKey: string;
  locale: 'ar' | 'en';
}) {
  const t = useTranslations('mp');
  const router = useRouter();
  const sp = useSearchParams();
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  function pushParams(mut: (p: URLSearchParams) => void) {
    const p = new URLSearchParams(sp.toString());
    mut(p);
    router.push(`/market?${p.toString()}`);
  }
  function setType(k: string) {
    // Type change resets attribute filters but keeps the partnership toggle (persistent).
    const p = new URLSearchParams();
    if (k) p.set('type', k);
    if (sp.get('partnership') === '1') p.set('partnership', '1');
    const qs = p.toString();
    router.push(qs ? `/market?${qs}` : '/market');
  }
  const csv = (k: string) => (sp.get(k) ? sp.get(k)!.split(',').filter(Boolean) : []);
  const partnershipOn = sp.get('partnership') === '1';

  return (
    <div className="space-y-4 rounded-lg border border-graphite/15 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <select value={typeKey} onChange={(e) => setType(e.target.value)} className="rounded-md border border-graphite/20 bg-transparent px-3 py-2 text-sm">
          <option value="">{t('allTypes')}</option>
          {types.map((x) => (<option key={x.key} value={x.key}>{L(x.nameAr, x.nameEn)}</option>))}
        </select>
        <button
          type="button"
          onClick={() => pushParams((p) => (p.get('partnership') === '1' ? p.delete('partnership') : p.set('partnership', '1')))}
          className={`rounded-full px-4 py-2 text-sm font-bold ${partnershipOn ? 'bg-primary text-soft' : 'border border-gold-300/60 bg-gold/10 hover:bg-gold/20'}`}
        >
          🤝 {t('partnershipOnly')}
        </button>
        {sp.toString() && <a href="/market" className="text-sm text-accent">{t('reset')}</a>}
      </div>

      {filterAttrs.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {filterAttrs.map((a) => (
            <div key={a.id} className="text-sm">
              <div className="mb-1 opacity-80">{L(a.labelAr, a.labelEn)}{a.unit ? ` (${localizeUnit(a.unit, locale)})` : ''}</div>
              {a.type === 'NUMBER' ? (
                <div className="flex items-center gap-2">
                  <input type="number" dir="ltr" defaultValue={sp.get(`${a.key}_min`) ?? ''} placeholder={t('from')} onBlur={(e) => pushParams((p) => (e.target.value ? p.set(`${a.key}_min`, e.target.value) : p.delete(`${a.key}_min`)))} className="w-24 rounded border border-graphite/20 bg-transparent px-2 py-1" />
                  <input type="number" dir="ltr" defaultValue={sp.get(`${a.key}_max`) ?? ''} placeholder={t('to')} onBlur={(e) => pushParams((p) => (e.target.value ? p.set(`${a.key}_max`, e.target.value) : p.delete(`${a.key}_max`)))} className="w-24 rounded border border-graphite/20 bg-transparent px-2 py-1" />
                </div>
              ) : a.type === 'BOOLEAN' ? (
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={sp.get(a.key) === '1'} onChange={() => pushParams((p) => (p.get(a.key) === '1' ? p.delete(a.key) : p.set(a.key, '1')))} />
                  {L(a.labelAr, a.labelEn)}
                </label>
              ) : (
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {a.options.map((o) => (
                    <label key={o.key} className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={csv(a.key).includes(o.key)}
                        onChange={() => pushParams((p) => {
                          const cur = csv(a.key);
                          const next = cur.includes(o.key) ? cur.filter((x) => x !== o.key) : [...cur, o.key];
                          if (next.length) p.set(a.key, next.join(','));
                          else p.delete(a.key);
                        })}
                      />
                      {L(o.labelAr, o.labelEn)}
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
