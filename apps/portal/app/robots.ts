import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.PORTAL_URL || 'https://newobour.com').replace(/\/$/, '');
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/account', '/api'] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
