import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { getStandardAreas } from '../../../../../lib/marketplace';
import { StandardAreasEditor } from './StandardAreasEditor';
import { OrderableList } from '../OrderableList';
import { reorderAttributes } from '../actions';

export default async function AttributesPage() {
  await requirePermission('marketplace', 'VIEW');
  const t = await getTranslations('mp');
  const standardAreas = await getStandardAreas();
  // "Categories" = the Type classifier's options; count how many each attribute applies to.
  const typeCls = await prisma.classifier.findUnique({ where: { key: 'type' }, select: { options: { select: { id: true } } } });
  const typeOptionIds = new Set((typeCls?.options ?? []).map((o) => o.id));
  const totalCats = typeOptionIds.size;
  const sections = await prisma.attributeSection.findMany({
    orderBy: { order: 'asc' },
    include: {
      attributes: {
        orderBy: { order: 'asc' },
        include: {
          _count: { select: { options: true } },
          classifierLinks: { select: { optionId: true } },
        },
      },
    },
  });
  const catCountOf = (a: { classifierLinks: { optionId: string }[] }) =>
    a.classifierLinks.filter((l) => typeOptionIds.has(l.optionId)).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('attributes')}</h1>
        <div className="flex items-center gap-3">
          <a href="/admin/marketplace/option-lists" className="text-sm text-accent">{t('optionLists')}</a>
          <a href="/admin/marketplace/attributes/new" className="rounded-md bg-primary px-3 py-1.5 text-sm text-soft">+ {t('new')}</a>
          <a href="/admin/marketplace" className="text-sm text-accent">← {t('title')}</a>
        </div>
      </div>

      <StandardAreasEditor areas={standardAreas} />

      {sections.map((s) => (
        <div key={s.id} className="space-y-2">
          <h2 className="font-semibold text-primary">
            {s.nameAr} <span className="opacity-50" dir="ltr">/ {s.nameEn}</span>
          </h2>
          <div className="overflow-x-auto rounded-lg border border-graphite/15">
            <table className="w-full text-sm">
              <tbody>
                {s.attributes.map((a) => (
                  <tr key={a.id} className="border-t border-graphite/10 first:border-t-0">
                    <td className="p-2">
                      {a.labelAr} <span className="opacity-50" dir="ltr">/ {a.labelEn}</span>
                    </td>
                    <td className="p-2"><span className="rounded bg-graphite/10 px-2 py-0.5 text-xs">{a.type}</span></td>
                    <td className="p-2 text-xs opacity-60">{a.unit ?? ''}</td>
                    <td className="p-2 text-xs">{a.filterable ? '🔍' : ''}</td>
                    <td className="p-2 text-xs opacity-60">
                      {(() => { const n = catCountOf(a); return <span className={n === 0 ? 'text-red-600' : n === totalCats ? 'text-green' : ''}><span dir="ltr">{n}/{totalCats}</span> {t('catCount')}</span>; })()}
                      {/* No links in ANY classifier → the attribute never appears on listing forms. */}
                      {a.classifierLinks.length === 0 && <span className="text-red-600"> · {t('notLinkedHidden')}</span>}
                      {a._count.options ? ` · ${a._count.options} ${t('optionCount')}` : ''}
                    </td>
                    <td className="p-2 text-end">
                      <a href={`/admin/marketplace/attributes/${a.id}`} className="text-accent">{t('edit')}</a>
                    </td>
                  </tr>
                ))}
                {s.attributes.length === 0 && (
                  <tr><td className="p-2 text-xs opacity-50">{t('none')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <OrderableList items={s.attributes.map((a) => ({ id: a.id, label: `${a.labelAr} / ${a.labelEn}` }))} action={reorderAttributes} />
        </div>
      ))}
    </div>
  );
}
