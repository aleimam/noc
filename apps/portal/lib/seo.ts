import type { Metadata } from 'next';

// Canonical origin for the portal (no trailing slash).
export const PORTAL_URL = (process.env.PORTAL_URL || 'https://newobour.com').replace(/\/$/, '');

/** Absolute URL from a root-relative path (or pass through an already-absolute URL). */
export function abs(path = ''): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${PORTAL_URL}${path ? (path.startsWith('/') ? path : `/${path}`) : ''}`;
}

type MetaInput = {
  title: string;
  description?: string;
  /** Canonical path, e.g. "/market/abc". */
  path: string;
  /** Root-relative or absolute image URLs (first is used for OG/Twitter). */
  images?: string[];
  type?: 'website' | 'article';
  locale?: 'ar' | 'en';
};

// Per-page metadata: unique title/description + canonical + Open Graph + Twitter card.
// NOTE: locale lives in the NEXT_LOCALE cookie (one URL serves both languages), so we set
// og:locale but deliberately do not emit hreflang alternates — pointing ar/en at the same
// URL would be meaningless. True hreflang needs URL-based locales (separate change).
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
      siteName: 'العبور الجديد',
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
