import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';

export default async function AttributesPage() {
  await requirePermission('marketplace', 'VIEW');
  const t = await getTranslations('mp');
  const sections = await prisma.attributeSection.findMany({
    orderBy: { order: 'asc' },
    include: {
      attributes: {
        orderBy: { order: 'asc' },
        include: { _count: { select: { options: true, typeLinks: true } } },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('attributes')}</h1>
        <div className="flex items-center gap-3">
          <a href="/admin/marketplace/attributes/new" className="rounded-md bg-primary px-3 py-1.5 text-sm text-soft">+ {t('new')}</a>
          <a href="/admin/marketplace" className="text-sm text-accent">← {t('title')}</a>
        </div>
      </div>

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
                      {a._count.typeLinks} {t('typeCount')}
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
        </div>
      ))}
    </div>
  );
}
