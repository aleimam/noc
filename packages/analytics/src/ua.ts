import UAParser from 'ua-parser-js';

const BOT_RE = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|whatsapp|telegrambot|headless|lighthouse|preview|monitor|pingdom|uptime/i;

/** Parse a User-Agent into device class / OS / browser. Bots are flagged so they can be
 *  filtered out of the human-facing dashboards. */
export function parseUa(ua: string | null): { device: string; os: string | null; browser: string | null } {
  if (!ua) return { device: 'unknown', os: null, browser: null };
  if (BOT_RE.test(ua)) return { device: 'bot', os: null, browser: null };
  const r = new UAParser(ua).getResult();
  const t = r.device.type; // 'mobile' | 'tablet' | undefined (=> desktop)
  const device = t === 'mobile' ? 'mobile' : t === 'tablet' ? 'tablet' : 'desktop';
  return { device, os: r.os.name ?? null, browser: r.browser.name ?? null };
}
