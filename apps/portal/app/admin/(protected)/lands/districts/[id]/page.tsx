import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { AdvantagesEditor, MasterplanEditor, UpdatesEditor } from '../../GeoContentEditors';
import { loadUpdates } from '../../geo';

export const dynamic = 'force-dynamic';

export default async function DistrictDetail({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('lands', 'VIEW');
  const { id } = await params;
  const district = await prisma.district.findUnique({ where: { id } });
  if (!district) notFound();

  const t = await getTranslations('lands');
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  const [advantages, updates, masterplan] = await Promise.all([
    prisma.advantage.findMany({ where: { districtId: id }, orderBy: { order: 'asc' } }),
    loadUpdates({ districtId: id }),
    prisma.attachment.findFirst({ where: { ownerType: 'Masterplan', ownerId: id }, orderBy: { createdAt: 'desc' } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{L(district.nameAr, district.nameEn)}</h1>
        <a href="/admin/lands/districts" className="text-sm text-accent">← {t('districts')}</a>
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold text-primary">{t('advantages')}</h2>
        <AdvantagesEditor level="district" targetId={id} advantages={advantages.map((a) => ({ id: a.id, textAr: a.textAr, textEn: a.textEn, order: a.order }))} locale={locale} />
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-primary">{t('masterplan')}</h2>
        <MasterplanEditor level="district" targetId={id} current={masterplan ? { id: masterplan.id, path: masterplan.path, originalName: masterplan.originalName } : null} />
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-primary">{t('updates')}</h2>
        <UpdatesEditor level="district" targetId={id} updates={updates} locale={locale} />
      </section>
    </div>
  );
}
