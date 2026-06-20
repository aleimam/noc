import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { BlocksManager } from '../../BlocksManager';
import { AdvantagesEditor, MasterplanEditor, UpdatesEditor, InheritedUpdates } from '../../GeoContentEditors';
import { loadUpdates } from '../../geo';

export const dynamic = 'force-dynamic';

export default async function NeighborhoodDetail({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('lands', 'VIEW');
  const { id } = await params;
  const n = await prisma.neighborhood.findUnique({
    where: { id },
    include: { district: true, blocks: { orderBy: { order: 'asc' } } },
  });
  if (!n) notFound();

  const t = await getTranslations('lands');
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  const [advantages, updates, masterplan, inherited] = await Promise.all([
    prisma.advantage.findMany({ where: { neighborhoodId: id }, orderBy: { order: 'asc' } }),
    loadUpdates({ neighborhoodId: id }),
    prisma.attachment.findFirst({ where: { ownerType: 'Masterplan', ownerId: id }, orderBy: { createdAt: 'desc' } }),
    loadUpdates({ districtId: n.districtId }), // inherited from the district
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">
          {L(n.district.nameAr, n.district.nameEn)} · {L(n.nameAr, n.nameEn)}
        </h1>
        <a href="/admin/lands/neighborhoods" className="text-sm text-accent">← {t('neighborhoods')}</a>
      </div>

      {n.hasBlocks && (
        <section className="space-y-2">
          <h2 className="font-semibold text-primary">{t('blocks')}</h2>
          <BlocksManager neighborhoodId={n.id} blocks={n.blocks.map((b) => ({ id: b.id, name: b.name, order: b.order }))} />
        </section>
      )}

      <section className="space-y-2">
        <h2 className="font-semibold text-primary">{t('advantages')}</h2>
        <AdvantagesEditor level="neighborhood" targetId={id} advantages={advantages.map((a) => ({ id: a.id, textAr: a.textAr, textEn: a.textEn, order: a.order }))} locale={locale} />
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-primary">{t('masterplan')}</h2>
        <MasterplanEditor level="neighborhood" targetId={id} current={masterplan ? { id: masterplan.id, path: masterplan.path, originalName: masterplan.originalName } : null} />
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-primary">{t('updates')}</h2>
        <UpdatesEditor level="neighborhood" targetId={id} updates={updates} locale={locale} />
        {inherited.length > 0 && (
          <>
            <h3 className="pt-2 text-sm font-semibold opacity-70">{L(n.district.nameAr, n.district.nameEn)}</h3>
            <InheritedUpdates updates={inherited} locale={locale} sourceLabel={L(n.district.nameAr, n.district.nameEn)} />
          </>
        )}
      </section>
    </div>
  );
}
