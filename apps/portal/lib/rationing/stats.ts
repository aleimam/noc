// Aggregated metrics for the public rationing dashboard. All server-side (prisma groupBy).
import { prisma } from '@noc/db';

export type Bar = { label: string; value: number };

export type DashboardStats = {
  totals: {
    owners: number; // listed owners (rows)
    plots: number;
    cities: number;
    latestListDate: string | null;
    avgOwnersPerPlot: number; // owners ÷ plots, 1 decimal
  };
  byCity: Bar[]; // owners by city (also serves as "top cities")
  byMonth: Bar[]; // owners by list-date month (trend)
  busiestPlots: Bar[]; // plots with the most owners
};

function fmtMonth(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export type RationingTotals = { owners: number; plots: number; cities: number; latestListDate: string | null };

/** Lightweight totals for the pre-search summary card. */
export async function getRationingTotals(): Promise<RationingTotals> {
  const [owners, plotGroups, cities, latest] = await Promise.all([
    prisma.rationingSheet.count(),
    prisma.rationingSheet.groupBy({ by: ['plotFullRef'], where: { plotFullRef: { not: null } }, _count: { _all: true } }),
    prisma.rationingCity.count(),
    prisma.rationingSheet.aggregate({ _max: { listDate: true } }),
  ]);
  return {
    owners,
    plots: plotGroups.length,
    cities,
    latestListDate: latest._max.listDate ? latest._max.listDate.toISOString().slice(0, 10) : null,
  };
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [owners, plotGroups, cities, latest, cityGroups, monthSheets, busiestGroups] = await Promise.all([
    prisma.rationingSheet.count(),
    prisma.rationingSheet.groupBy({ by: ['plotFullRef'], where: { plotFullRef: { not: null } }, _count: { _all: true } }),
    prisma.rationingCity.count(),
    prisma.rationingSheet.aggregate({ _max: { listDate: true } }),
    prisma.rationingSheet.groupBy({ by: ['cityId'], _count: { _all: true } }),
    prisma.rationingSheet.findMany({ where: { listDate: { not: null } }, select: { listDate: true } }),
    prisma.rationingSheet.groupBy({
      by: ['plotFullRef'],
      where: { plotFullRef: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { plotFullRef: 'desc' } },
      take: 8,
    }),
  ]);

  const plots = plotGroups.length;

  const cityRows = await prisma.rationingCity.findMany({ select: { id: true, name: true } });
  const cityName = new Map(cityRows.map((c) => [c.id, c.name]));
  const byCity: Bar[] = cityGroups
    .map((g) => ({ label: g.cityId ? cityName.get(g.cityId) ?? '—' : '—', value: g._count._all }))
    .sort((a, b) => b.value - a.value);

  const monthMap = new Map<string, number>();
  for (const s of monthSheets) if (s.listDate) monthMap.set(fmtMonth(s.listDate), (monthMap.get(fmtMonth(s.listDate)) ?? 0) + 1);
  const byMonth: Bar[] = [...monthMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([label, value]) => ({ label, value }));

  const busiestPlots: Bar[] = busiestGroups
    .filter((g) => g.plotFullRef)
    .map((g) => ({ label: g.plotFullRef as string, value: g._count._all }));

  return {
    totals: {
      owners,
      plots,
      cities,
      latestListDate: latest._max.listDate ? latest._max.listDate.toISOString().slice(0, 10) : null,
      avgOwnersPerPlot: plots ? Math.round((owners / plots) * 10) / 10 : 0,
    },
    byCity,
    byMonth,
    busiestPlots,
  };
}
