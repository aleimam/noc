import type { Metadata } from 'next';

// Canonical origin for the brokerage storefront (no trailing slash).
export const BROKERAGE_URL = (process.env.BROKERAGE_URL || 'https://alsawarey.com').replace(/\/$/, '');

/** Absolute URL from a root-relative path (or pass through an already-absolute URL). */
export function abs(path = ''): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${BROKERAGE_URL}${path ? (path.startsWith('/') ? path : `/${path}`) : ''}`;
}

type MetaInput = {
  title: string;
  description?: string;
  /** Canonical path, e.g. "/listings/abc". */
  path: string;
  images?: string[];
  type?: 'website' | 'article';
  locale?: 'ar' | 'en';
};

// Per-page metadata: unique title/description + canonical + Open Graph + Twitter card.
// Locale is cookie-based (one URL for both languages), so we set og:locale but not hreflang.
export function pageMeta({ title, description, path, images, type = 'website', locale = 'ar' }: MetaInput): Metadata {
  const url = abs(path);
  const imgs = (images ?? []).filter(Boolean).map((i) => abs(i));
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: 'الصواري',
      type,
      images: imgs,
      locale: locale === 'en' ? 'en_US' : 'ar_EG',
    },
    twitter: { card: imgs.length ? 'summary_large_image' : 'summary', title, description, images: imgs },
  };
}

/** BreadcrumbList JSON-LD from an ordered list of crumbs. */
export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: abs(it.path) })),
  };
}

/** Serialize a JSON-LD object for a <script> tag, escaping "<" so user text can't break out. */
export const ldJson = (data: unknown): string => JSON.stringify(data).replace(/</g, '\\u003c');
