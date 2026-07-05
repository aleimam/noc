import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { ClassifierOptionsEditor } from './ClassifierOptionsEditor';
import { OrderableList } from '../../OrderableList';
import { upsertClassifierOption, deleteClassifierOption, reorderClassifierOptions, toggleClassifierOptionFlag } from '../../actions';

// Hard nesting: a Purpose option's parent is a Type option; a Condition option's parent is a Purpose option.
const PARENT_KEY: Record<string, string | undefined> = { purpose: 'type', condition: 'purpose' };

export default async function ClassifierOptionsPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('marketplace', 'VIEW');
  const { id } = await params;
  const t = await getTranslations('mp');
  const locale = (await getLocale()) as 'ar' | 'en';
  const classifier = await prisma.classifier.findUnique({
    where: { id },
    include: { options: { orderBy: { order: 'asc' }, include: { parentLinks: { select: { parentId: true } } } } },
  });
  if (!classifier) notFound();

  const parentKey = PARENT_KEY[classifier.key];
  const parentOptions = parentKey
    ? await prisma.classifierOption.findMany({ where: { classifier: { key: parentKey } }, orderBy: { order: 'asc' }, select: { id: true, nameAr: true, nameEn: true } })
    : [];
  const showAlsawarey = classifier.key === 'type' || classifier.key === 'purpose';

  // All active details (attributes) grouped by section + this classifier's option→attribute
  // links, so each option's edit can show an applicability grid.
  const [attrSectionsRaw, attrLinks] = await Promise.all([
    prisma.attributeSection.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      include: { attributes: { where: { isActive: true }, orderBy: { order: 'asc' }, select: { id: true, labelAr: true, labelEn: true } } },
    }),
    prisma.attributeClassifier.findMany({ where: { option: { classifierId: id } }, select: { optionId: true, attributeId: true } }),
  ]);
  const attrSections = attrSectionsRaw
    .map((s) => ({
      id: s.id,
      name: locale === 'en' ? s.nameEn || s.nameAr : s.nameAr,
      attributes: s.attributes.map((a) => ({ id: a.id, label: locale === 'en' ? a.labelEn || a.labelAr : a.labelAr })),
    }))
    .filter((s) => s.attributes.length > 0);
  const attrLinksByOption: Record<string, string[]> = {};
  for (const l of attrLinks) (attrLinksByOption[l.optionId] ??= []).push(l.attributeId);

  const data = classifier.options.map((o) => ({
    id: o.id,
    key: o.key,
    nameAr: o.nameAr,
    nameEn: o.nameEn,
    order: o.order,
    isActive: o.isActive,
    parentIds: o.parentLinks.map((l) => l.parentId),
    allowedOnAlsawarey: o.allowedOnAlsawarey,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{classifier.nameAr} / {classifier.nameEn}</h1>
        <a href="/admin/marketplace/classifiers" className="text-sm text-accent">← {t('classifiers')}</a>
      </div>
      <ClassifierOptionsEditor
        initial={data}
        parentOptions={parentOptions}
        parentLabel={parentKey === 'type' ? t('classifierType') : parentKey === 'purpose' ? t('classifierPurpose') : ''}
        showAlsawarey={showAlsawarey}
        attrSections={attrSections}
        attrLinksByOption={attrLinksByOption}
        upsert={upsertClassifierOption.bind(null, classifier.id)}
        remove={deleteClassifierOption}
        toggleFlag={toggleClassifierOptionFlag}
      />
      <OrderableList items={classifier.options.map((o) => ({ id: o.id, label: `${o.nameAr} / ${o.nameEn}` }))} action={reorderClassifierOptions} />
    </div>
  );
}
