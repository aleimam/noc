import { getLocale } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { PageEditor } from '../PageEditor';

export const dynamic = 'force-dynamic';

export default async function NewPage() {
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  await requirePermission('content', 'CREATE');
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{L('صفحة جديدة', 'New page')}</h1>
        <a href="/admin/pages" className="text-sm text-accent">{L('← الصفحات', '← Pages')}</a>
      </div>
      <PageEditor initial={{ brand: 'newobour', slug: '', titleAr: '', titleEn: '', bodyAr: '', bodyEn: '', published: false, footerOrder: 0 }} />
    </div>
  );
}
