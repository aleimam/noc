/** Classify a visit's traffic source from its referrer + UTM tags:
 *  campaign (has UTM) › organic (search engines) › social › referral › direct. */
export function classifySource(
  ref: string | null | undefined,
  utm?: { source?: string | null; medium?: string | null },
): { source: string } {
  if (utm?.source || utm?.medium) return { source: 'campaign' };
  if (!ref) return { source: 'direct' };
  let host = '';
  try {
    host = new URL(ref).hostname.toLowerCase();
  } catch {
    return { source: 'direct' };
  }
  if (/(google|bing|yahoo|duckduckgo|yandex|ecosia|baidu)\./.test(host)) return { source: 'organic' };
  if (/(facebook|fb\.|instagram|t\.co|twitter|x\.com|tiktok|youtube|linkedin|whatsapp|wa\.me|t\.me|telegram|pinterest)/.test(host)) return { source: 'social' };
  return { source: 'referral' };
}
