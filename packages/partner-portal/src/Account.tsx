import { getLocale } from 'next-intl/server';
import { requirePartner } from '@noc/auth';
import { prisma } from '@noc/db';
import { AccountForm } from './AccountForm';

/** Partner self-service account page: login identifiers + password. Shared by both apps. */
export async function PartnerAccount() {
  const { userId } = await requirePartner();
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true, email: true, phone: true, passwordHash: true },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-black text-navy-800 dark:text-soft">{L('حسابي', 'My account')}</h1>
        <p className="mt-1 text-sm text-ink-500">
          {L('وسائل الدخول الخاصة بك — أبقِ واحدة على الأقل.', 'Your login identifiers — keep at least one.')}
        </p>
      </div>
      <AccountForm
        initial={{
          username: user?.username ?? '',
          email: user?.email ?? '',
          phone: user?.phone ?? '',
          hasPassword: !!user?.passwordHash,
        }}
        locale={locale}
      />
    </div>
  );
}
