import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { AdvantagesEditor, AreaMapEditor, UpdatesEditor, CustomPhotosEditor } from '../../GeoContentEditors';
import { loadAreaMaps, loadUpdates } from '../../geo';
import { EditSaveBar } from '@/app/_components/EditSaveBar';

export const dynamic = 'force-dynamic';

export default async function CityEdit({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('lands', 'VIEW');
  const { id } = await params;
  const city = await prisma.city.findUnique({ where: { id } });
  if (!city) notFound();

  const t = await getTranslations('lands');
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  const [advantages, maps, updates] = await Promise.all([
    prisma.advantage.findMany({ where: { cityId: id }, orderBy: { order: 'asc' } }),
    loadAreaMaps('city', id),
    loadUpdates({ cityId: id }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('edit')}: {L(city.nameAr, city.nameEn)}</h1>
        <div className="flex items-center gap-3">
          <a href="/admin/lands/cities" className="text-sm text-accent">← {t('cities')}</a>
          <EditSaveBar hint />
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold text-primary">{t('advantages')}</h2>
        <AdvantagesEditor level="city" targetId={id} advantages={advantages.map((a) => ({ id: a.id, textAr: a.textAr, textEn: a.textEn, order: a.order }))} locale={locale} />
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-primary">{t('updates')}</h2>
        {/* City-level updates inherit down to districts/neighborhoods per the inheritance matrix. */}
        <UpdatesEditor level="city" targetId={id} updates={updates} followerCount={0} locale={locale} />
      </section>

      {/* City maps are all uploaded (the city is the top of the chain; nothing to annotate). */}
      <div className="grid gap-6 sm:grid-cols-2">
        <section className="space-y-2">
          <h2 className="font-semibold text-primary">{t('masterplan')}</h2>
          <AreaMapEditor level="city" targetId={id} kind="masterplan" map={maps.masterplan} annotatable={false} />
        </section>
        <section className="space-y-2">
          <h2 className="font-semibold text-primary">{t('locationMap')}</h2>
          <AreaMapEditor level="city" targetId={id} kind="location" map={maps.location} annotatable={false} />
        </section>
        <section className="space-y-2">
          <h2 className="font-semibold text-primary">{t('servicesMap')}</h2>
          <AreaMapEditor level="city" targetId={id} kind="services" map={maps.services} annotatable={false} />
        </section>
        <section className="space-y-2">
          <h2 className="font-semibold text-primary">{t('mainRoadsMap')}</h2>
          <AreaMapEditor level="city" targetId={id} kind="mainroads" map={maps.mainroads} annotatable={false} />
        </section>
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold text-primary">{L('صور إضافية', 'Extra photos')}</h2>
        <CustomPhotosEditor level="city" targetId={id} photos={maps.custom} />
      </section>

      <div className="flex justify-end border-t border-graphite/15 pt-4"><EditSaveBar /></div>
    </div>
  );
}
