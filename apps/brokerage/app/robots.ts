import type { MetadataRoute } from 'next';

// AI crawlers explicitly welcomed (per owner decision); private areas stay disallowed.
const AI_BOTS = [
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-Web', 'anthropic-ai',
  'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot-Extended', 'CCBot',
  'Amazonbot', 'Meta-ExternalAgent', 'cohere-ai',
];
const DISALLOW = ['/account', '/api', '/admin-enter', '/admin-leave'];

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.BROKERAGE_URL || 'https://alsawarey.com').replace(/\/$/, '');
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: DISALLOW },
      ...AI_BOTS.map((userAgent) => ({ userAgent, allow: '/', disallow: DISALLOW })),
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
