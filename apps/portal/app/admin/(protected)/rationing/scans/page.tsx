import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { buildScanReport } from './actions';
import { ScansManager } from './ScansClient';

export const dynamic = 'force-dynamic';

export default async function ScansPage() {
  await requirePermission('sheets', 'VIEW');
  const t = await getTranslations('rationing');
  const report = await buildScanReport();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('scansTitle')}</h1>
        <div className="flex items-center gap-3">
          <a href="/admin/rationing/scans/export" className="rounded-md border border-graphite/25 px-3 py-1.5 text-sm hover:bg-graphite/10">⬇ {t('exportScansReport')}</a>
          <a href="/admin/rationing" className="text-sm text-accent">← {t('title')}</a>
        </div>
      </div>
      <p className="text-sm opacity-70">{t('scansHint')}</p>
      <ScansManager report={report} />
    </div>
  );
}
