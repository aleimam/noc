import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { CategoryAttributesManager } from './CategoryAttributesManager';

export const dynamic = 'force-dynamic';

export default async function CategoryAttributesPage() {
  await requirePermission('marketplace', 'VIEW');
  const t = await getTranslations('mp');
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'en' ? en : ar);

  const [classifiers, sections, links, renders] = await Promise.all([
    prisma.classifier.findMany({
      orderBy: { order: 'asc' },
      include: { options: { where: { isActive: true }, orderBy: { order: 'asc' }, select: { id: true, nameAr: true, nameEn: true } } },
    }),
    prisma.attributeSection.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      include: { attributes: { where: { isActive: true }, orderBy: { order: 'asc' }, select: { id: true, labelAr: true, labelEn: true } } },
    }),
    prisma.attributeClassifier.findMany({ select: { optionId: true, attributeId: true } }),
    prisma.categorySectionRender.findMany({ select: { optionId: true, sectionId: true, makeCard: true, onPoster: true } }),
  ]);

  const linksByOption: Record<string, string[]> = {};
  for (const l of links) (linksByOption[l.optionId] ??= []).push(l.attributeId);
  const marksByOption: Record<string, Record<string, { makeCard: boolean; onPoster: boolean }>> = {};
  for (const r of renders) (marksByOption[r.optionId] ??= {})[r.sectionId] = { makeCard: r.makeCard, onPoster: r.onPoster };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('categoryAttrs')}</h1>
        <a href="/admin/marketplace/attributes" className="text-sm text-accent">{t('attributes')}</a>
      </div>
      <CategoryAttributesManager
        classifiers={classifiers.map((c) => ({ key: c.key, name: `${c.nameAr} / ${c.nameEn}`, options: c.options.map((o) => ({ id: o.id, name: locale === 'en' ? o.nameEn : o.nameAr })) }))}
        sections={sections.map((s) => ({ id: s.id, name: L(s.nameAr, s.nameEn), attributes: s.attributes.map((a) => ({ id: a.id, label: L(a.labelAr, a.labelEn) })) }))}
        linksByOption={linksByOption}
        marksByOption={marksByOption}
      />
    </div>
  );
}
