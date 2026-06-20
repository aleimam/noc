import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { BlocksManager } from '../../BlocksManager';

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">
          {L(n.district.nameAr, n.district.nameEn)} · {L(n.nameAr, n.nameEn)}
        </h1>
        <a href="/admin/lands/neighborhoods" className="text-sm text-accent">← {t('neighborhoods')}</a>
      </div>
      <section className="space-y-2">
        <h2 className="font-semibold">{t('blocks')}</h2>
        <BlocksManager neighborhoodId={n.id} blocks={n.blocks.map((b) => ({ id: b.id, name: b.name, order: b.order }))} />
      </section>
    </div>
  );
}
