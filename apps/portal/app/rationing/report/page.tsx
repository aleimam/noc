import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { auth } from '@noc/auth';
import { prisma } from '@noc/db';
import { SiteShell } from '../../_components/SiteShell';
import { ReportForm } from './ReportForm';

export const dynamic = 'force-dynamic';

export default async function ReportMissedSheetPage() {
  const t = await getTranslations('rationing');
  const session = await auth();
  // Logged-in reporters aren't asked for name/phone — we already have them.
  const account = session?.user
    ? await prisma.user
        .findUnique({ where: { id: session.user.id }, select: { name: true, phone: true } })
        .then((u) => ({ name: u?.name || u?.phone || '' }))
    : null;
  const cities = await prisma.rationingCity.findMany({
    where: { isActive: true },
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true },
  });

  return (
    <SiteShell active="rationing">
      <div className="mx-auto max-w-2xl space-y-5 p-4 sm:p-6">
        <Link href="/rationing" className="inline-block text-base text-navy-600">‹ {t('backToSearch')}</Link>
        <div className="text-center">
          <h1 className="text-3xl font-black text-navy-800 dark:text-soft">{t('reportMissedTitle')}</h1>
          <p className="mt-2 text-lg text-ink-600">{t('reportMissedIntro')}</p>
        </div>
        <ReportForm cities={cities} account={account} />
      </div>
    </SiteShell>
  );
}
