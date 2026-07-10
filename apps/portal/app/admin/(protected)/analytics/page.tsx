import { getLocale } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { parseRange, getOverview, getRecentSessions, getEventStats, getDailyRollups, getSavedViews, type SiteFilter } from '../../../../lib/analytics';
import { SavedViews } from './SavedViews';

export const dynamic = 'force-dynamic';

const fmtDur = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`);
const fmtDate = (d: Date, locale: string) => new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' }).format(d);

export default async function VisitorAnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePermission('settings', 'VIEW');
  const sp = await searchParams;
  const range = parseRange(sp);
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const [ov, recent, ev, roll, savedViews] = await Promise.all([getOverview(range), getRecentSessions(range, 100), getEventStats(range), getDailyRollups(range), getSavedViews()]);

  const qs = (patch: Record<string, string | number>) => {
    const p = new URLSearchParams({ days: String(range.days), site: range.site, ...Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, String(v)])) });
    return `?${p.toString()}`;
  };
  const siteLabel = (s: SiteFilter) => (s === 'all' ? L('الموقعان', 'Both sites') : s === 'newobour' ? 'New Obour' : 'Al Sawarey');
  const chip = (active: boolean) => `rounded-lg px-3 py-1 text-sm font-semibold ${active ? 'bg-primary text-soft' : 'border border-graphite/25 hover:bg-graphite/10'}`;

  const kpis = [
    { label: L('الزوّار', 'Visitors'), value: ov.kpis.visitors },
    { label: L('زوّار جدد', 'New visitors'), value: ov.kpis.newVisitors },
    { label: L('الجلسات', 'Sessions'), value: ov.kpis.sessions },
    { label: L('مشاهدات الصفحات', 'Pageviews'), value: ov.kpis.pageviews },
    { label: L('متوسط مدة الجلسة', 'Avg. session'), value: fmtDur(ov.kpis.avgDuration) },
    { label: L('صفحات/جلسة', 'Pages / session'), value: ov.kpis.pagesPerSession },
    { label: L('نسبة الارتداد', 'Bounce rate'), value: `${ov.kpis.bounceRate}%` },
    { label: L('جلسات مسجّلة الدخول', 'Logged-in'), value: ov.kpis.loggedIn },
  ];

  // Bar chart geometry (pageviews per day).
  const W = 900, H = 200, PAD = 24;
  const max = Math.max(1, ...ov.series.map((d) => d.pageviews));
  const bw = ov.series.length ? (W - 2 * PAD) / ov.series.length : 0;

  const Table = ({ title, rows, unit }: { title: string; rows: { label: string; count: number }[]; unit?: string }) => {
    const total = rows.reduce((a, r) => a + r.count, 0) || 1;
    return (
      <div className="rounded-lg border border-graphite/15 p-4">
        <h3 className="mb-2 text-sm font-bold text-primary">{title}</h3>
        {rows.length === 0 ? (
          <p className="text-xs opacity-50">{L('لا توجد بيانات', 'No data')}</p>
        ) : (
          <div className="space-y-1.5">
            {rows.map((r) => (
              <div key={r.label} className="text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{r.label}</span>
                  <span className="font-num shrink-0 opacity-70">{r.count}{unit ? ` ${unit}` : ''}</span>
                </div>
                <div className="mt-0.5 h-1.5 overflow-hidden rounded bg-graphite/10">
                  <div className="h-full rounded bg-gold" style={{ width: `${Math.round((r.count / total) * 100)}%` }} />
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
        <h1 className="text-2xl font-bold text-primary">{L('تحليلات الزوّار', 'Visitor analytics')}</h1>
        <a href={`/admin/analytics/export${qs({})}`} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-soft">⬇ {L('تصدير CSV', 'Export CSV')}</a>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1.5">
          {([7, 30, 90, 365] as const).map((d) => (
            <a key={d} href={qs({ days: d })} className={chip(range.days === d)}>{d === 365 ? L('سنة', '1y') : `${d}${L('ي', 'd')}`}</a>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          {(['all', 'newobour', 'alsawarey'] as const).map((s) => (
            <a key={s} href={qs({ site: s })} className={chip(range.site === s)}>{siteLabel(s)}</a>
          ))}
        </div>
      </div>

      {/* Saved filter presets */}
      <SavedViews views={savedViews} current={{ days: range.days, site: range.site }} locale={locale} />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-lg border border-graphite/15 p-4">
            <div className="text-xs opacity-60">{k.label}</div>
            <div className="mt-1 font-num text-2xl font-black text-primary">{k.value}</div>
          </div>
        ))}
      </div>

      {/* Pageviews-per-day chart */}
      <div className="rounded-lg border border-graphite/15 p-4">
        <h3 className="mb-2 text-sm font-bold text-primary">{L('مشاهدات الصفحات يوميًا', 'Pageviews per day')}</h3>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" role="img">
          <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="currentColor" strokeOpacity="0.15" />
          {ov.series.map((d, i) => {
            const h = Math.round(((H - 2 * PAD) * d.pageviews) / max);
            return <rect key={d.day} x={PAD + i * bw + bw * 0.15} y={H - PAD - h} width={bw * 0.7} height={h} rx="2" className="fill-gold" />;
          })}
        </svg>
        <div className="mt-1 flex justify-between text-[10px] opacity-50">
          <span>{ov.series[0]?.day}</span>
          <span>{ov.series[ov.series.length - 1]?.day}</span>
        </div>
      </div>

      {/* Breakdowns */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Table title={L('المصادر', 'Sources')} rows={ov.sources} />
        <Table title={L('الأجهزة', 'Devices')} rows={ov.devices} />
        <Table title={L('الدول', 'Countries')} rows={ov.countries} />
        <Table title={L('المتصفحات', 'Browsers')} rows={ov.browsers} />
        <Table title={L('أنظمة التشغيل', 'Operating systems')} rows={ov.oses} />
      </div>

      {/* ── Phase 2: engagement funnel ── */}
      <div className="rounded-lg border border-graphite/15 p-4">
        <h3 className="mb-3 text-sm font-bold text-primary">{L('مسار التحويل', 'Engagement funnel')}</h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: L('شاهدوا إعلانًا', 'Viewed a listing'), value: ev.funnel.views, pct: 100 },
            { label: L('أضافوا للمفضلة', 'Saved'), value: ev.funnel.saved, pct: ev.funnel.views ? Math.round((ev.funnel.saved / ev.funnel.views) * 100) : 0 },
            { label: L('تواصلوا', 'Contacted'), value: ev.funnel.contacted, pct: ev.funnel.views ? Math.round((ev.funnel.contacted / ev.funnel.views) * 100) : 0 },
          ].map((s, i) => (
            <div key={i} className="rounded-lg border border-graphite/10 p-3 text-center">
              <div className="font-num text-2xl font-black text-primary">{s.value}</div>
              <div className="mt-0.5 text-xs opacity-70">{s.label}</div>
              {i > 0 && <div className="mt-1 text-xs font-bold text-gold-700">{s.pct}%</div>}
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs opacity-50">{L('من الجلسات التي شاهدت إعلانًا — كم أضاف للمفضلة ثم تواصل.', 'Of sessions that viewed a listing — how many saved, then contacted.')}</p>
      </div>

      {/* ── Phase 3: visitor cohorts (new vs returning) ── */}
      <div className="rounded-lg border border-graphite/15 p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-sm font-bold text-primary">{L('الزوّار الجدد والعائدون', 'New vs returning')}</h3>
          <span className="text-xs opacity-60">{L('نسبة العودة', 'Returning rate')} <span className="font-num font-bold text-gold-700">{ov.cohorts.returningRate}%</span></span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: L('زوّار جدد', 'New'), value: ov.cohorts.newVisitors },
            { label: L('زوّار عائدون', 'Returning'), value: ov.cohorts.returningVisitors },
            { label: L('عادوا أكثر من مرة', 'Repeat (≥2 visits)'), value: ov.cohorts.repeatVisitors },
          ].map((c) => (
            <div key={c.label} className="rounded-lg border border-graphite/10 p-3 text-center">
              <div className="font-num text-2xl font-black text-primary">{c.value}</div>
              <div className="mt-0.5 text-xs opacity-70">{c.label}</div>
            </div>
          ))}
        </div>
        {ov.cohorts.newVisitors + ov.cohorts.returningVisitors > 0 && (
          <div className="mt-3 flex h-2.5 overflow-hidden rounded bg-graphite/10">
            <div className="h-full bg-gold" style={{ width: `${Math.round((ov.cohorts.newVisitors / (ov.cohorts.newVisitors + ov.cohorts.returningVisitors)) * 100)}%` }} title={L('جدد', 'New')} />
            <div className="h-full bg-primary/60" style={{ flex: 1 }} title={L('عائدون', 'Returning')} />
          </div>
        )}
      </div>

      {/* ── Phase 2: events + search intelligence ── */}
      <div className="grid gap-3 lg:grid-cols-3">
        <Table title={L('التفاعلات', 'Events')} rows={ev.byType} />
        <Table title={L('أكثر عمليات البحث', 'Top searches')} rows={ev.topSearches} />
        <div className="rounded-lg border border-red-200 bg-red-50/40 p-4">
          <h3 className="mb-2 text-sm font-bold text-red-700">{L('بحث بلا نتائج', 'Zero-result searches')}</h3>
          {ev.zeroResults.length === 0 ? (
            <p className="text-xs opacity-50">{L('لا يوجد', 'None')}</p>
          ) : (
            <div className="space-y-1.5">
              {ev.zeroResults.map((r) => (
                <div key={r.label} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{r.label}</span>
                  <span className="font-num shrink-0 font-bold text-red-700">{r.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Phase 3: experience health — Core Web Vitals + frustration ── */}
      <div className="grid gap-3 lg:grid-cols-3">
        {(() => {
          // Google thresholds: LCP good<2.5s / poor>4s; CLS good<0.1 / poor>0.25.
          type Rating = 'good' | 'ni' | 'poor';
          const rate = (v: number, good: number, poor: number): Rating => (v <= good ? 'good' : v < poor ? 'ni' : 'poor');
          const tone: Record<Rating, string> = { good: 'text-emerald-600', ni: 'text-amber-600', poor: 'text-red-600' };
          const cards = [
            ev.webVitals.lcp
              ? { label: 'LCP', sub: L('أكبر عنصر مرئي', 'Largest paint'), text: `${(ev.webVitals.lcp.avg / 1000).toFixed(2)}s`, n: ev.webVitals.lcp.samples, r: rate(ev.webVitals.lcp.avg, 2500, 4000) }
              : { label: 'LCP', sub: L('أكبر عنصر مرئي', 'Largest paint'), text: '—', n: 0, r: null },
            ev.webVitals.cls
              ? { label: 'CLS', sub: L('ثبات التخطيط', 'Layout shift'), text: ev.webVitals.cls.avg.toFixed(3), n: ev.webVitals.cls.samples, r: rate(ev.webVitals.cls.avg, 0.1, 0.25) }
              : { label: 'CLS', sub: L('ثبات التخطيط', 'Layout shift'), text: '—', n: 0, r: null },
          ] as const;
          return (
            <>
              {cards.map((c) => (
                <div key={c.label} className="rounded-lg border border-graphite/15 p-4">
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-sm font-bold text-primary">{c.label}</h3>
                    <span className="text-[10px] opacity-50">{c.sub}</span>
                  </div>
                  <div className={`mt-1 font-num text-3xl font-black ${c.r ? tone[c.r] : 'opacity-40'}`}>{c.text}</div>
                  <div className="mt-0.5 text-[11px] opacity-50">{c.n} {L('عيّنة', 'samples')}</div>
                </div>
              ))}
              <div className="rounded-lg border border-graphite/15 p-4">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-sm font-bold text-primary">{L('نقرات الإحباط', 'Rage clicks')}</h3>
                  <span className="text-[10px] opacity-50">{L('نقر متكرر سريع', 'Rapid repeat clicks')}</span>
                </div>
                <div className={`mt-1 font-num text-3xl font-black ${ev.rageClicks > 0 ? 'text-red-600' : 'opacity-40'}`}>{ev.rageClicks}</div>
                {ev.ragePages.length > 0 && (
                  <div className="mt-1 space-y-0.5 text-[11px] opacity-70">
                    {ev.ragePages.slice(0, 3).map((p) => (
                      <div key={p.label} className="flex justify-between gap-2"><span className="truncate" dir="ltr">{p.label}</span><span className="font-num shrink-0">{p.count}</span></div>
                    ))}
                  </div>
                )}
              </div>
            </>
          );
        })()}
      </div>

      {/* Top pages */}
      <div className="overflow-x-auto rounded-lg border border-graphite/15">
        <div className="border-b border-graphite/15 p-3 text-sm font-bold text-primary">{L('أكثر الصفحات زيارة', 'Top pages')}</div>
        <table className="w-full text-sm">
          <thead className="text-xs opacity-60">
            <tr className="border-b border-graphite/10">
              <th className="p-2 text-start">{L('الصفحة', 'Page')}</th>
              <th className="p-2 text-end">{L('مشاهدات', 'Views')}</th>
              <th className="p-2 text-end">{L('متوسط المدة', 'Avg. time')}</th>
              <th className="p-2 text-end">{L('متوسط التمرير', 'Avg. scroll')}</th>
            </tr>
          </thead>
          <tbody>
            {ov.topPages.length === 0 ? (
              <tr><td colSpan={4} className="p-3 text-center opacity-50">{L('لا توجد بيانات بعد', 'No data yet')}</td></tr>
            ) : ov.topPages.map((p) => (
              <tr key={p.path} className="border-b border-graphite/5">
                <td className="max-w-xs truncate p-2" dir="ltr">{p.path}</td>
                <td className="p-2 text-end font-num">{p.views}</td>
                <td className="p-2 text-end font-num">{fmtDur(p.avgDuration)}</td>
                <td className="p-2 text-end font-num">{p.avgScroll}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Recent sessions */}
      <div className="overflow-x-auto rounded-lg border border-graphite/15">
        <div className="border-b border-graphite/15 p-3 text-sm font-bold text-primary">{L('أحدث الجلسات', 'Recent sessions')}</div>
        <table className="w-full text-sm">
          <thead className="text-xs opacity-60">
            <tr className="border-b border-graphite/10">
              <th className="p-2 text-start">{L('الوقت', 'Time')}</th>
              <th className="p-2 text-start">{L('الموقع', 'Site')}</th>
              <th className="p-2 text-start">{L('المكان', 'Location')}</th>
              <th className="p-2 text-start">{L('الجهاز', 'Device')}</th>
              <th className="p-2 text-start">{L('المصدر', 'Source')}</th>
              <th className="p-2 text-end">{L('صفحات', 'Pages')}</th>
              <th className="p-2 text-end">{L('المدة', 'Duration')}</th>
            </tr>
          </thead>
          <tbody>
            {recent.length === 0 ? (
              <tr><td colSpan={7} className="p-3 text-center opacity-50">{L('لا توجد جلسات بعد', 'No sessions yet')}</td></tr>
            ) : recent.map((s) => (
              <tr key={s.id} className="border-b border-graphite/5">
                <td className="whitespace-nowrap p-2" dir="ltr">{fmtDate(s.startedAt, locale)}</td>
                <td className="p-2">{s.site === 'newobour' ? 'New Obour' : 'Al Sawarey'}</td>
                <td className="p-2">{[s.city, s.country].filter(Boolean).join(', ') || '—'}</td>
                <td className="p-2">{[s.device, s.os, s.browser].filter(Boolean).join(' · ') || '—'}{s.userId ? ' 👤' : ''}</td>
                <td className="p-2">{s.source ?? '—'}</td>
                <td className="p-2 text-end font-num">{s.pageviews}</td>
                <td className="p-2 text-end font-num">{fmtDur(s.durationSec)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Phase 3: long-term trend from daily rollups (survives the retention prune) ── */}
      <div className="rounded-lg border border-graphite/15 p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-sm font-bold text-primary">{L('الاتجاه طويل المدى', 'Long-term trend')}</h3>
          <span className="text-xs opacity-60">
            {roll.days} {L('يوم', 'days')} · {roll.totals.sessions} {L('جلسة', 'sessions')} · {roll.totals.pageviews} {L('مشاهدة', 'pageviews')}
          </span>
        </div>
        {roll.series.length === 0 ? (
          <p className="text-xs opacity-50">{L('يُبنى الملخّص اليومي ليلًا؛ لا توجد بيانات ملخّصة بعد.', 'Daily rollups are built nightly; no summarized data yet.')}</p>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" role="img">
            <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="currentColor" strokeOpacity="0.15" />
            {(() => {
              const rmax = Math.max(1, ...roll.series.map((d) => d.pageviews));
              const rbw = (W - 2 * PAD) / roll.series.length;
              return roll.series.map((d, i) => {
                const h = Math.round(((H - 2 * PAD) * d.pageviews) / rmax);
                return <rect key={d.day} x={PAD + i * rbw + rbw * 0.15} y={H - PAD - h} width={Math.max(1, rbw * 0.7)} height={h} rx="2" className="fill-primary/60" />;
              });
            })()}
          </svg>
        )}
        <p className="mt-1 text-[10px] opacity-50">{L('مشاهدات الصفحات يوميًا من الملخّص المُجمَّع — يبقى محفوظًا بعد حذف البيانات الخام.', 'Pageviews/day from aggregated rollups — retained after raw data is pruned.')}</p>
      </div>

      <p className="text-xs opacity-50">
        {L(
          'تتبّع أولي مجهول الهوية (بدون تخزين عنوان IP الصريح). البيانات لا تشمل الزوّار الآليين (bots) ولا صفحات لوحة التحكم.',
          'First-party, anonymized tracking (no raw IP stored). Excludes bots and admin pages.',
        )}
      </p>
    </div>
  );
}
