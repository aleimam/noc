import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { auth } from '@noc/auth';
import { prisma } from '@noc/db';
import { PublicShell } from '@noc/ui';
import { FollowForm } from './FollowForm';

export const dynamic = 'force-dynamic';

function str(v: string | string[] | undefined): string {
  return (typeof v === 'string' ? v : '').trim();
}

export default async function FollowPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const kind = (str(sp.kind) === 'found' ? 'FOUND' : 'WATCH') as 'FOUND' | 'WATCH';
  const sheetId = str(sp.sheet) || undefined;
  const q = str(sp.q);

  const t = await getTranslations('rationing');

  // Account required (#11). Send unauthenticated visitors to OTP login, returning here.
  const session = await auth();
  if (!session?.user) {
    const self = `/rationing/follow?kind=${kind === 'FOUND' ? 'found' : 'watch'}${sheetId ? `&sheet=${sheetId}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`;
    redirect(`/app/login?next=${encodeURIComponent(self)}`);
  }

  const cities = await prisma.rationingCity.findMany({
    where: { isActive: true },
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true },
  });

  let defaults: { applicantName?: string; plotNo?: string; blockNo?: string; originalOwner?: string; cityId?: string } = {};
  if (sheetId) {
    const s = await prisma.rationingSheet.findUnique({
      where: { id: sheetId },
      select: { applicantName: true, plotNo: true, blockNo: true, originalOwner: true, cityId: true },
    });
    if (s) defaults = { applicantName: s.applicantName, plotNo: s.plotNo, blockNo: s.blockNo, originalOwner: s.originalOwner ?? '', cityId: s.cityId ?? '' };
  } else if (q) {
    defaults = { applicantName: q };
  }

  return (
    <PublicShell active="rationing">
      <div className="mx-auto max-w-2xl space-y-5 p-4 sm:p-6">
        <Link href="/rationing" className="inline-block text-sm text-navy-600">‹ {t('backToSearch')}</Link>
        <div>
          <h1 className="text-3xl font-black text-navy-800">{kind === 'FOUND' ? t('followFoundTitle') : t('followWatchTitle')}</h1>
          <p className="mt-2 text-lg text-ink-600">{kind === 'FOUND' ? t('followFoundSub') : t('followWatchSub')}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-md">
          <FollowForm kind={kind} cities={cities} defaults={defaults} sheetId={sheetId} />
        </div>
      </div>
    </PublicShell>
  );
}
