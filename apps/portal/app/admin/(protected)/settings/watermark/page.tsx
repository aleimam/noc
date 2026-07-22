import { getLocale } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { getStampSettings } from '../../../../../lib/stamp';
import { WatermarkClient } from './WatermarkClient';

export const dynamic = 'force-dynamic';

export default async function StampPage() {
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  await requirePermission('appearance', 'VIEW');
  const [initial, contacts, typeOptions] = await Promise.all([
    getStampSettings(),
    prisma.brandContact.findMany({ orderBy: [{ brand: 'asc' }, { order: 'asc' }], select: { id: true, brand: true, type: true, value: true, isActive: true } }),
    prisma.classifierOption.findMany({ where: { isActive: true, classifier: { key: 'type' } }, orderBy: { order: 'asc' }, select: { id: true, nameAr: true, nameEn: true } }),
  ]);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{L('ختم الصور والعلامة المائية', 'Photo stamping & watermark')}</h1>
        <a href="/admin" className="text-sm text-accent">{L('← لوحة التحكم', '← Dashboard')}</a>
      </div>
      <WatermarkClient initial={initial} contacts={contacts} typeOptions={typeOptions} />
    </div>
  );
}
