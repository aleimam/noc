import { getLocale } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { ApplicationActions } from './ApplicationActions';

export const dynamic = 'force-dynamic';

type Status = 'PENDING' | 'REVIEWING' | 'APPROVED' | 'REJECTED';
const STATUSES: Status[] = ['PENDING', 'REVIEWING', 'APPROVED', 'REJECTED'];

export default async function PartnerApplicationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePermission('marketplace', 'VIEW');
  const sp = await searchParams;
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const filter = (STATUSES as string[]).includes(String(sp.status)) ? (sp.status as Status) : 'all';

  const [rows, grouped] = await Promise.all([
    prisma.partnerApplication.findMany({ where: filter === 'all' ? {} : { status: filter }, orderBy: { createdAt: 'desc' }, take: 300 }),
    prisma.partnerApplication.groupBy({ by: ['status'], _count: true }),
  ]);
  const count = (s: Status) => grouped.find((g) => g.status === s)?._count ?? 0;
  const total = grouped.reduce((a, g) => a + (g._count as number), 0);

  const statusLabel: Record<Status, string> = {
    PENDING: L('جديد', 'New'), REVIEWING: L('قيد المراجعة', 'Reviewing'), APPROVED: L('مقبول', 'Approved'), REJECTED: L('مرفوض', 'Rejected'),
  };
  const statusTone: Record<Status, string> = {
    PENDING: 'bg-gold/20 text-gold-800', REVIEWING: 'bg-navy-100 text-navy-700', APPROVED: 'bg-green/15 text-green', REJECTED: 'bg-red-100 text-red-700',
  };
  const typeLabel = (v: string | null) =>
    v === 'individual' ? L('فرد / مالك', 'Individual') : v === 'broker' ? L('سمسار', 'Broker') : v === 'company' ? L('شركة', 'Company') : v === 'developer' ? L('مطوّر', 'Developer') : v === 'other' ? L('أخرى', 'Other') : '—';
  const fmt = (d: Date) => new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(d);
  const chip = (active: boolean) => `rounded-lg px-3 py-1 text-sm font-semibold ${active ? 'bg-primary text-soft' : 'border border-graphite/25 hover:bg-graphite/10'}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{L('طلبات الشراكة', 'Partner applications')}</h1>
        <a href="/admin/marketplace" className="text-sm text-accent">← {L('السوق العقاري', 'Marketplace')}</a>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <a href="/admin/marketplace/partner-applications" className={chip(filter === 'all')}>{L('الكل', 'All')} ({total})</a>
        {STATUSES.map((s) => (
          <a key={s} href={`/admin/marketplace/partner-applications?status=${s}`} className={chip(filter === s)}>{statusLabel[s]} ({count(s)})</a>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-graphite/15 p-6 text-center text-sm opacity-60">{L('لا توجد طلبات.', 'No applications.')}</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="rounded-lg border border-graphite/15 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span className="text-lg font-bold text-primary">{r.name}</span>
                  {r.businessName && <span className="ms-2 text-sm opacity-70">— {r.businessName}</span>}
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm opacity-80">
                    <a href={`tel:${r.phone}`} dir="ltr" className="font-num text-accent">{r.phone}</a>
                    {r.email && <a href={`mailto:${r.email}`} dir="ltr" className="text-accent">{r.email}</a>}
                    <span>{typeLabel(r.businessType)}</span>
                    {r.areas && <span className="opacity-70">📍 {r.areas}</span>}
                  </div>
                </div>
                <div className="text-end">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${statusTone[r.status as Status]}`}>{statusLabel[r.status as Status]}</span>
                  <div className="mt-1 text-xs opacity-50" dir="ltr">{fmt(r.createdAt)}</div>
                </div>
              </div>
              {r.message && <p className="mt-2 whitespace-pre-wrap rounded-md bg-graphite/5 p-2.5 text-sm">{r.message}</p>}
              <ApplicationActions id={r.id} status={r.status as Status} note={r.reviewNote} locale={locale} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
