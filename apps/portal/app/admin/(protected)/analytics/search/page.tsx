import { getLocale } from 'next-intl/server';
import { auth, requirePermission, hasPermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { getSearchOverview, type SearchSurface, type TermRow } from '../../../../../lib/searchAnalytics';
import { SynonymManager, type SynonymRow } from './SynonymManager';

export const dynamic = 'force-dynamic';

type SiteFilter = 'all' | 'newobour' | 'alsawarey';
type SurfaceFilter = 'all' | SearchSurface;

const DAYS = [7, 30, 90, 365] as const;
const SITES: SiteFilter[] = ['all', 'newobour', 'alsawarey'];
const SURFACES: SurfaceFilter[] = ['all', 'market', 'storefront', 'rationing'];

export default async function SearchIntelligencePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePermission('analytics', 'VIEW');
  const sp = await searchParams;
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const pct = (n: number) => `${Math.round(n * 100)}%`;

  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const days = DAYS.includes(Number(one(sp.days)) as (typeof DAYS)[number]) ? (Number(one(sp.days)) as (typeof DAYS)[number]) : 30;
  const site = (SITES.includes(one(sp.site) as SiteFilter) ? one(sp.site) : 'all') as SiteFilter;
  const surface = (SURFACES.includes(one(sp.surface) as SurfaceFilter) ? one(sp.surface) : 'all') as SurfaceFilter;

  const [ov, session, synonymRows] = await Promise.all([
    getSearchOverview({ site: site === 'all' ? null : site, surface: surface === 'all' ? null : surface, days }),
    auth(),
    prisma.searchSynonym.findMany({ orderBy: { updatedAt: 'desc' }, select: { id: true, terms: true, site: true, surface: true, note: true, isActive: true } }),
  ]);
  const canManage = !!session?.user && hasPermission(session.user.perms, 'analytics', 'MANAGE');
  const synonyms: SynonymRow[] = synonymRows;

  const qs = (patch: Record<string, string | number>) => {
    const p = new URLSearchParams({ days: String(days), site, surface, ...Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, String(v)])) });
    return `?${p.toString()}`;
  };
  const chip = (active: boolean) => `rounded-lg px-3 py-1 text-sm font-semibold ${active ? 'bg-primary text-soft' : 'border border-graphite/25 hover:bg-graphite/10'}`;
  const siteLabel = (s: SiteFilter) => (s === 'all' ? L('الموقعان', 'Both sites') : s === 'newobour' ? 'New Obour' : 'Al Sawarey');
  const surfaceLabel = (s: SurfaceFilter) =>
    s === 'all' ? L('كل المواضع', 'All surfaces') : s === 'market' ? L('سوق العبور', 'Market') : s === 'storefront' ? L('متجر الصواري', 'Storefront') : L('كشوف التقنين', 'Rationing');

  const f = ov.funnel;
  const kpis = [
    { label: L('عمليات البحث', 'Searches'), value: f.searches },
    { label: L('بحث بنتائج', 'With results'), value: f.withResults },
    { label: L('نتائج تم فتحها', 'Results opened'), value: f.selections },
    { label: L('تحوّلات (تواصل/عرض)', 'Conversions'), value: f.conversions },
    { label: L('نسبة بلا نتائج', 'Zero-result rate'), value: pct(ov.zeroRate) },
    { label: L('نسبة إعادة البحث', 'Refinement rate'), value: pct(ov.refinementRate) },
    { label: L('كلمات بحث مختلفة', 'Distinct terms'), value: ov.distinctTerms },
    { label: L('معدل التحوّل', 'Search→contact'), value: f.searches ? pct(f.conversions / f.searches) : '0%' },
  ];

  // Funnel bar geometry: searches → with-results → selections → conversions.
  const steps = [
    { label: L('بحث', 'Searches'), value: f.searches },
    { label: L('بنتائج', 'Results'), value: f.withResults },
    { label: L('فُتحت', 'Opened'), value: f.selections },
    { label: L('تحوّل', 'Converted'), value: f.conversions },
  ];
  const fMax = Math.max(1, ...steps.map((s) => s.value));

  const TermTable = ({ title, rows, metric }: { title: string; rows: TermRow[]; metric: 'count' | 'zeroCount' | 'convertedCount' }) => {
    const max = Math.max(1, ...rows.map((r) => r[metric]));
    return (
      <div className="rounded-lg border border-graphite/15 p-4">
        <h3 className="mb-2 text-sm font-bold text-primary">{title}</h3>
        {rows.length === 0 ? (
          <p className="text-xs opacity-50">{L('لا توجد بيانات', 'No data')}</p>
        ) : (
          <div className="space-y-1.5">
            {rows.map((r) => (
              <div key={r.normalized} className="text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate" dir="auto">{r.sample}</span>
                  <span className="font-num shrink-0 opacity-70">
                    {r[metric]}
                    {metric === 'count' && r.zeroCount > 0 && <span className="text-red-600"> · {r.zeroCount} {L('بلا نتيجة', 'zero')}</span>}
                    {metric === 'count' && r.convertedCount > 0 && <span className="text-green"> · {r.convertedCount} {L('تحوّل', 'conv')}</span>}
                  </span>
                </div>
                <div className="mt-0.5 h-1.5 overflow-hidden rounded bg-graphite/10">
                  <div className={`h-full rounded ${metric === 'zeroCount' ? 'bg-red-500' : metric === 'convertedCount' ? 'bg-green' : 'bg-gold'}`} style={{ width: `${Math.round((r[metric] / max) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{L('ذكاء البحث', 'Search intelligence')}</h1>
        <a href="/admin/analytics" className="text-sm text-accent hover:underline">{L('تحليلات الزوّار ›', 'Visitor analytics ›')}</a>
      </div>
      <p className="max-w-2xl text-sm opacity-70">
        {L(
          'ما الذي يبحث عنه الزوّار فعليًا عبر سوق العبور ومتجر الصواري وكشوف التقنين — وأين لا يجدون نتائج. استعمل «بلا نتائج» لاكتشاف الطلب غير الملبّى.',
          'What visitors actually search across the market, storefront and rationing — and where they find nothing. Use the zero-result list to spot unmet demand.',
        )}
      </p>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1.5">
          {DAYS.map((d) => (
            <a key={d} href={qs({ days: d })} className={chip(days === d)}>{d === 365 ? L('سنة', '1y') : `${d}${L('ي', 'd')}`}</a>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          {SITES.map((s) => (
            <a key={s} href={qs({ site: s })} className={chip(site === s)}>{siteLabel(s)}</a>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          {SURFACES.map((s) => (
            <a key={s} href={qs({ surface: s })} className={chip(surface === s)}>{surfaceLabel(s)}</a>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-lg border border-graphite/15 p-4">
            <div className="text-xs opacity-60">{k.label}</div>
            <div className="mt-1 font-num text-2xl font-black text-primary">{k.value}</div>
          </div>
        ))}
      </div>

      {/* Funnel: search → results → open → convert */}
      <div className="rounded-lg border border-graphite/15 p-4">
        <h3 className="mb-3 text-sm font-bold text-primary">{L('مسار البحث', 'Search funnel')}</h3>
        <div className="space-y-2">
          {steps.map((s, i) => (
            <div key={s.label} className="text-sm">
              <div className="flex items-center justify-between gap-2">
                <span>{s.label}</span>
                <span className="font-num opacity-70">
                  {s.value}
                  {i > 0 && steps[0]!.value > 0 && <span className="opacity-50"> · {pct(s.value / steps[0]!.value)}</span>}
                </span>
              </div>
              <div className="mt-0.5 h-2.5 overflow-hidden rounded bg-graphite/10">
                <div className="h-full rounded bg-primary" style={{ width: `${Math.round((s.value / fMax) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Term breakdowns */}
      <div className="grid gap-3 lg:grid-cols-3">
        <TermTable title={L('أكثر كلمات البحث', 'Top search terms')} rows={ov.topTerms} metric="count" />
        <TermTable title={L('بحث بلا نتائج', 'Zero-result terms')} rows={ov.zeroTerms} metric="zeroCount" />
        <TermTable title={L('كلمات أدّت لتحوّل', 'Terms that converted')} rows={ov.convertingTerms} metric="convertedCount" />
      </div>

      {/* Synonym dictionary — fix the zero-result terms above by teaching the search equivalences. */}
      <SynonymManager groups={synonyms} canManage={canManage} locale={locale} />
    </div>
  );
}
