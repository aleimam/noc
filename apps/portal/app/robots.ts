import type { MetadataRoute } from 'next';

// AI crawlers are explicitly welcomed (per owner decision) — same crawl scope as any bot:
// public pages yes, private/admin areas no.
const AI_BOTS = [
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-Web', 'anthropic-ai',
  'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot-Extended', 'CCBot',
  'Amazonbot', 'Meta-ExternalAgent', 'cohere-ai',
];
const DISALLOW = ['/admin', '/account', '/api'];

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.PORTAL_URL || 'https://newobour.com').replace(/\/$/, '');
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: DISALLOW },
      ...AI_BOTS.map((userAgent) => ({ userAgent, allow: '/', disallow: DISALLOW })),
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
