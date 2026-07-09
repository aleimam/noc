import { getLocale } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { parseRange, getOverview, getRecentSessions, type SiteFilter } from '../../../../lib/analytics';

export const dynamic = 'force-dynamic';

const fmtDur = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`);
const fmtDate = (d: Date, locale: string) => new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' }).format(d);

export default async function VisitorAnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePermission('settings', 'VIEW');
  const sp = await searchParams;
  const range = parseRange(sp);
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const [ov, recent] = await Promise.all([getOverview(range), getRecentSessions(range, 100)]);

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

      <p className="text-xs opacity-50">
        {L(
          'تتبّع أولي مجهول الهوية (بدون تخزين عنوان IP الصريح). البيانات لا تشمل الزوّار الآليين (bots) ولا صفحات لوحة التحكم.',
          'First-party, anonymized tracking (no raw IP stored). Excludes bots and admin pages.',
        )}
      </p>
    </div>
  );
}
