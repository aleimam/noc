import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { auth } from '@noc/auth';
import { prisma } from '@noc/db';
import { DeleteFollowButton } from './FollowRow';

export const dynamic = 'force-dynamic';

const STATUS_KEY: Record<string, string> = { active: 'statusActive', matched: 'statusMatched', closed: 'statusClosed' };

export default async function MyFollowsPage() {
  const session = await auth();
  if (session?.user?.type !== 'CUSTOMER') redirect('/account/login?next=/account/follows');

  const locale = (await getLocale()) as 'ar' | 'en';
  const t = await getTranslations('account');

  const [rationing, lands] = await Promise.all([
    prisma.rationingFollow.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      include: { city: { select: { name: true } } },
    }),
    prisma.landFollow.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      include: { district: { select: { nameAr: true, nameEn: true } }, neighborhood: { select: { nameAr: true, nameEn: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">{t('myFollows')}</h1>
        <p className="text-sm opacity-75">{t('myFollowsIntro')}</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-primary">{t('rationingFollows')}</h2>
        {rationing.length === 0 ? (
          <p className="rounded-lg border border-dashed border-graphite/25 p-5 text-center text-sm opacity-70">{t('noFollows')}</p>
        ) : (
          <ul className="space-y-3">
            {rationing.map((f) => (
              <li key={f.id} className="flex items-start justify-between gap-3 rounded-xl border border-graphite/15 p-4">
                <div>
                  <p className="font-bold text-primary">{f.applicantName}</p>
                  <p className="text-sm opacity-75">
                    {[f.city?.name, f.blockNo && `${t('block')} ${f.blockNo}`, f.plotNo && `${t('plot')} ${f.plotNo}`].filter(Boolean).join(' • ') || '—'}
                  </p>
                  <span className="mt-2 inline-block rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">
                    {t(STATUS_KEY[f.status] ?? 'statusActive')}
                  </span>
                </div>
                <DeleteFollowButton id={f.id} kind="rationing" />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-primary">{t('landFollows')}</h2>
        {lands.length === 0 ? (
          <p className="rounded-lg border border-dashed border-graphite/25 p-5 text-center text-sm opacity-70">{t('noFollows')}</p>
        ) : (
          <ul className="space-y-3">
            {lands.map((f) => {
              const area = [f.district && (locale === 'en' ? f.district.nameEn : f.district.nameAr), f.neighborhood && (locale === 'en' ? f.neighborhood.nameEn : f.neighborhood.nameAr)].filter(Boolean).join(' • ');
              return (
                <li key={f.id} className="flex items-start justify-between gap-3 rounded-xl border border-graphite/15 p-4">
                  <div>
                    <p className="font-bold text-primary">{area || t('landFollows')}</p>
                    {f.note && <p className="text-sm opacity-75">{f.note}</p>}
                  </div>
                  <DeleteFollowButton id={f.id} kind="land" />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
