'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

export function RationingTabs({ active, showDashboard = true }: { active: 'applicants' | 'plots' | 'analytics'; showDashboard?: boolean }) {
  const t = useTranslations('rationing');
  const tabs: { key: string; href: string; label: string }[] = [
    { key: 'applicants', href: '/rationing', label: t('tabApplicants') },
    { key: 'plots', href: '/rationing/plots', label: t('tabPlots') },
    ...(showDashboard ? [{ key: 'analytics', href: '/rationing/dashboard', label: t('tabAnalytics') }] : []),
  ];
  return (
    <div className="flex gap-1 rounded-2xl bg-white p-1.5 shadow-sm">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={`flex-1 rounded-xl px-4 py-2.5 text-center text-sm font-bold transition ${
            active === tab.key ? 'bg-navy-800 text-soft' : 'text-navy-700 hover:bg-navy-50'
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
