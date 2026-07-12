'use server';

import { auth, hasPermission } from '@noc/auth';
import { prisma } from '@noc/db';

// One backend record the global admin search can jump to. `type` is a stable key the
// client maps to a localized group heading; `href` deep-links to the edit/manage page.
export type AdminSearchHit = { type: string; label: string; href: string };

const LIMIT = 6; // per entity kind — keep the dropdown tight

// Searches backend structure/config (attributes, classifiers + options, detail groups,
// option lists, amenities, building conditions) by Arabic OR English name. Every group is
// gated by the caller's section permission, so results never leak beyond what they can open.
export async function adminSearch(qRaw: string): Promise<AdminSearchHit[]> {
  const q = qRaw.trim();
  if (q.length < 2) return [];
  const session = await auth();
  const user = session?.user;
  if (!user || user.type !== 'STAFF') return [];
  const can = (section: string) => hasPermission(user.perms, section, 'VIEW');
  const like = { contains: q }; // MySQL/MariaDB collation is case-insensitive
  const out: AdminSearchHit[] = [];
  const tasks: Promise<void>[] = [];

  if (can('catalog')) {
    tasks.push(
      (async () => {
        const [attrs, classifiers, options, sections, lists] = await Promise.all([
          prisma.attribute.findMany({ where: { OR: [{ labelAr: like }, { labelEn: like }, { key: like }] }, select: { id: true, labelAr: true, labelEn: true }, take: LIMIT }),
          prisma.classifier.findMany({ where: { OR: [{ nameAr: like }, { nameEn: like }] }, select: { id: true, nameAr: true, nameEn: true }, take: LIMIT }),
          prisma.classifierOption.findMany({ where: { OR: [{ nameAr: like }, { nameEn: like }] }, select: { classifierId: true, nameAr: true, nameEn: true }, take: LIMIT }),
          prisma.attributeSection.findMany({ where: { OR: [{ nameAr: like }, { nameEn: like }] }, select: { nameAr: true, nameEn: true }, take: LIMIT }),
          prisma.optionList.findMany({ where: { name: like }, select: { name: true }, take: LIMIT }),
        ]);
        for (const a of attrs) out.push({ type: 'attribute', label: `${a.labelAr} / ${a.labelEn}`, href: `/admin/marketplace/attributes/${a.id}` });
        for (const c of classifiers) out.push({ type: 'classifier', label: `${c.nameAr} / ${c.nameEn}`, href: `/admin/marketplace/classifiers/${c.id}` });
        for (const o of options) out.push({ type: 'option', label: `${o.nameAr} / ${o.nameEn}`, href: `/admin/marketplace/classifiers/${o.classifierId}` });
        for (const s of sections) out.push({ type: 'section', label: `${s.nameAr} / ${s.nameEn}`, href: '/admin/marketplace/sections' });
        for (const l of lists) out.push({ type: 'optionList', label: l.name, href: '/admin/marketplace/option-lists' });
      })(),
    );
  }
  if (can('lands')) {
    tasks.push(
      (async () => {
        const amenities = await prisma.amenity.findMany({ where: { OR: [{ titleAr: like }, { titleEn: like }] }, select: { titleAr: true, titleEn: true }, take: LIMIT });
        for (const a of amenities) out.push({ type: 'amenity', label: a.titleAr + (a.titleEn ? ` / ${a.titleEn}` : ''), href: '/admin/lands/amenities' });
      })(),
    );
  }
  if (can('content')) {
    tasks.push(
      (async () => {
        const conds = await prisma.buildingCondition.findMany({ where: { OR: [{ titleAr: like }, { titleEn: like }] }, select: { id: true, titleAr: true, titleEn: true }, take: LIMIT });
        for (const c of conds) out.push({ type: 'condition', label: `${c.titleAr} / ${c.titleEn}`, href: `/admin/guide/conditions/${c.id}` });
      })(),
    );
  }

  await Promise.all(tasks);
  return out;
}
