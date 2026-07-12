import { requirePermission } from '@noc/auth';
import { PageEditor } from '../PageEditor';

export const dynamic = 'force-dynamic';

export default async function NewPage() {
  await requirePermission('content', 'CREATE');
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">صفحة جديدة</h1>
        <a href="/admin/pages" className="text-sm text-accent">← الصفحات</a>
      </div>
      <PageEditor initial={{ brand: 'newobour', slug: '', titleAr: '', titleEn: '', bodyAr: '', bodyEn: '', published: false, footerOrder: 0 }} />
    </div>
  );
}
