import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import { SiteShell } from '../../_components/SiteShell';
import { ApplyForm } from './ApplyForm';

// Partner marketing page — canonical home is /partner/join (the old /partners 308s here).
// Deliberately OUTSIDE the (protected) group: it is public, like its sibling /partner/login.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: locale === 'en' ? 'Partners — New Obour' : 'الشركاء — العبور الجديد' };
}

export default async function PartnersPage() {
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  const benefits = [
    { icon: '📢', title: L('انشر إعلاناتك بنفسك', 'Post your own listings'), desc: L('أضف عروضك وعدّل أسعارها في أي وقت.', 'Add your offers and update prices anytime.') },
    { icon: '📊', title: L('لوحة تحكم وإحصائيات', 'Dashboard & analytics'), desc: L('تابع المشاهدات والتواصل على كل إعلان.', 'Track views and contacts on every listing.') },
    { icon: '🌍', title: L('ظهور أوسع', 'Wider reach'), desc: L('عروضك تظهر على موقعنا ومنصّة الصواري.', 'Your offers appear on our portal and Al Sawarey.') },
  ];

  return (
    <SiteShell>
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <section className="rounded-3xl bg-navy-800 p-8 text-center text-white">
          <h1 className="text-3xl font-black">🤝 {L('كن شريكًا معنا', 'Become our partner')}</h1>
          <p className="mx-auto mt-2 max-w-xl text-navy-100">
            {L('انضم كشريك لتنشر عروضك العقارية وتديرها بنفسك مع دعم فريقنا.', 'Join as a partner to publish and manage your property listings yourself, backed by our team.')}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <a href="#apply" className="rounded-xl bg-gold px-6 py-3 text-base font-bold text-navy-900 transition hover:brightness-95">{L('تقدّم كشريك', 'Apply now')}</a>
            <a href="/partner/login" className="rounded-xl border border-white/30 px-6 py-3 text-base font-bold text-white transition hover:bg-white/10">{L('دخول بوابة الشركاء', 'Partner sign in')}</a>
          </div>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          {benefits.map((b) => (
            <div key={b.title} className="rounded-2xl border border-ink-200 bg-white p-5 text-center">
              <div className="text-3xl">{b.icon}</div>
              <h3 className="mt-2 font-bold text-navy-800">{b.title}</h3>
              <p className="mt-1 text-sm text-ink-500">{b.desc}</p>
            </div>
          ))}
        </section>

        <section id="apply" className="mt-10 scroll-mt-24">
          <h2 className="mb-1 text-xl font-black text-navy-800">{L('نموذج التقديم', 'Application form')}</h2>
          <p className="mb-4 text-sm text-ink-500">{L('املأ بياناتك وسيتواصل معك فريقنا لمراجعة الطلب.', 'Fill in your details and our team will contact you to review it.')}</p>
          <ApplyForm />
        </section>
      </div>
    </SiteShell>
  );
}
