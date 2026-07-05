'use client';

import { useState, type FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function StaffLoginPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // Auth.js v5 can either resolve with { ok:false, error } OR reject when
      // credentials are wrong — handle both so the message always appears.
      const res = await signIn('staff', { email, password, redirect: false });
      if (res && res.ok && !res.error) {
        router.push('/admin');
        router.refresh();
        return;
      }
      setError(t('invalidCredentials'));
    } catch {
      setError(t('invalidCredentials'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl border border-graphite/15 p-6"
      >
        <h1 className="text-xl font-bold text-primary">{t('staffLogin')}</h1>
        <div className="space-y-1">
          <label className="block text-sm">{t('email')}</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
            className="w-full rounded-md border border-graphite/20 bg-transparent px-3 py-2"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-sm">{t('password')}</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full rounded-md border border-graphite/20 bg-transparent px-3 py-2"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-primary px-3 py-2 text-soft disabled:opacity-60"
        >
          {loading ? `${t('verify')}…` : t('signIn')}
        </button>
      </form>
    </main>
  );
}
