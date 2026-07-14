import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { NewCityForm } from './NewCityForm';

export const dynamic = 'force-dynamic';

export default async function NewCity() {
  await requirePermission('lands', 'CREATE');
  const t = await getTranslations('lands');
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('addCity')}</h1>
        <a href="/admin/lands/cities" className="text-sm text-accent">← {t('cities')}</a>
      </div>
      <NewCityForm />
    </div>
  );
}
