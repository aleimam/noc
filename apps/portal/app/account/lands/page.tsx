import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { auth } from '@noc/auth';
import { prisma } from '@noc/db';
import { MyLandsClient, type LandRow } from './MyLandsClient';

export const dynamic = 'force-dynamic';

export default async function MyLandsPage() {
  const session = await auth();
  if (session?.user?.type !== 'CUSTOMER') redirect('/account/login?next=/account/lands');

  const locale = (await getLocale()) as 'ar' | 'en';
  const t = await getTranslations('account');

  const [rows, districts, neighborhoods] = await Promise.all([
    prisma.userLand.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: 'desc' } }),
    prisma.district.findMany({ where: { isActive: true }, orderBy: { order: 'asc' }, select: { id: true, nameAr: true, nameEn: true } }),
    prisma.neighborhood.findMany({ where: { isActive: true }, orderBy: { order: 'asc' }, select: { id: true, districtId: true, nameAr: true, nameEn: true } }),
  ]);

  const lands: LandRow[] = rows.map((l) => ({
    id: l.id,
    title: l.title,
    districtId: l.districtId,
    neighborhoodId: l.neighborhoodId,
    blockNo: l.blockNo,
    plotNo: l.plotNo,
    area: l.area != null ? String(l.area) : null,
    notes: l.notes,
    getUpdates: l.getUpdates,
    forSale: l.forSale,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">{t('myLands')}</h1>
        <p className="text-sm opacity-75">{t('myLandsIntro')}</p>
      </div>
      <MyLandsClient
        lands={lands}
        districts={districts.map((d) => ({ id: d.id, name: locale === 'en' ? d.nameEn : d.nameAr }))}
        neighborhoods={neighborhoods.map((n) => ({ id: n.id, districtId: n.districtId, name: locale === 'en' ? n.nameEn : n.nameAr }))}
      />
    </div>
  );
}
