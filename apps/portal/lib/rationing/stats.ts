// Aggregated metrics for the public rationing dashboard. All server-side (prisma groupBy).
import { prisma } from '@noc/db';

export type Bar = { label: string; value: number };

export type DashboardStats = {
  totals: {
    applicants: number;
    plots: number;
    owners: number;
    cities: number;
    batches: number;
    latestListDate: string | null;
    scanCoveragePct: number; // % of rows (with a source file) that have an uploaded scan
  };
  byCity: Bar[];
  topOwners: Bar[];
  byDay: Bar[];
  byMonth: Bar[]; // applicants by list-date month
  declarations: { required: number; notRequired: number };
};

// Natural week order (Arabic labels as stored).
const DAY_ORDER = ['السبت', 'الأحد', 'الاثنين', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

function fmtMonth(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [applicants, plotGroups, ownerGroups, cities, batches, latest, cityGroups, topOwnerGroups, dayGroups, declGroups, monthSheets, sourceGroups, scans] =
    await Promise.all([
      prisma.rationingSheet.count(),
      prisma.rationingSheet.groupBy({ by: ['plotFullRef'], where: { plotFullRef: { not: null } }, _count: { _all: true } }),
      prisma.rationingSheet.groupBy({ by: ['ownerNorm'], where: { ownerNorm: { not: null } }, _count: { _all: true } }),
      prisma.rationingCity.count(),
      prisma.sheetImportBatch.count(),
      prisma.rationingSheet.aggregate({ _max: { listDate: true } }),
      prisma.rationingSheet.groupBy({ by: ['cityId'], _count: { _all: true } }),
      prisma.rationingSheet.groupBy({
        by: ['originalOwner'],
        where: { originalOwner: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { originalOwner: 'desc' } },
        take: 20,
      }),
      prisma.rationingSheet.groupBy({ by: ['attendanceDay'], where: { attendanceDay: { not: null } }, _count: { _all: true } }),
      prisma.rationingSheet.groupBy({ by: ['declarationRequired'], _count: { _all: true } }),
      prisma.rationingSheet.findMany({ where: { listDate: { not: null } }, select: { listDate: true } }),
      prisma.rationingSheet.groupBy({ by: ['sourceFile'], where: { sourceFile: { not: null } }, _count: { _all: true } }),
      prisma.rationingScan.findMany({ select: { fileName: true } }),
    ]);

  // City names for the byCity chart
  const cityRows = await prisma.rationingCity.findMany({ select: { id: true, name: true } });
  const cityName = new Map(cityRows.map((c) => [c.id, c.name]));
  const byCity: Bar[] = cityGroups
    .map((g) => ({ label: g.cityId ? cityName.get(g.cityId) ?? '—' : '—', value: g._count._all }))
    .sort((a, b) => b.value - a.value);

  const topOwners: Bar[] = topOwnerGroups
    .filter((g) => g.originalOwner)
    .map((g) => ({ label: g.originalOwner as string, value: g._count._all }));

  const byDay: Bar[] = dayGroups
    .map((g) => ({ label: (g.attendanceDay as string).trim(), value: g._count._all }))
    .sort((a, b) => {
      const ia = DAY_ORDER.indexOf(a.label);
      const ib = DAY_ORDER.indexOf(b.label);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

  // applicants by list-date month
  const monthMap = new Map<string, number>();
  for (const s of monthSheets) if (s.listDate) monthMap.set(fmtMonth(s.listDate), (monthMap.get(fmtMonth(s.listDate)) ?? 0) + 1);
  const byMonth: Bar[] = [...monthMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([label, value]) => ({ label, value }));

  let required = 0;
  let notRequired = 0;
  for (const g of declGroups) {
    if (g.declarationRequired) required += g._count._all;
    else notRequired += g._count._all;
  }

  const scanSet = new Set(scans.map((s) => s.fileName));
  let covered = 0;
  let withSource = 0;
  for (const g of sourceGroups) {
    withSource += g._count._all;
    if (g.sourceFile && scanSet.has(g.sourceFile)) covered += g._count._all;
  }
  const scanCoveragePct = withSource ? Math.round((covered / withSource) * 100) : 0;

  return {
    totals: {
      applicants,
      plots: plotGroups.length,
      owners: ownerGroups.length,
      cities,
      batches,
      latestListDate: latest._max.listDate ? latest._max.listDate.toISOString().slice(0, 10) : null,
      scanCoveragePct,
    },
    byCity,
    topOwners,
    byDay,
    byMonth,
    declarations: { required, notRequired },
  };
}
