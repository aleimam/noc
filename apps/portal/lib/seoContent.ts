// SEO Phase 3 — admin-editable intro blocks + social links, stored as Setting rows.
//   seo.intro.<pageKey>  JSON { ar, en }   (pageKey: home | market | explore |
//                                            city.<id> | district.<id>)
//   social.<brand>       newline/comma-separated profile URLs (see @noc/config)
// Server-only (reads Prisma); public pages render the localized text as PLAIN text
// (React-escaped) — never HTML, so no sanitiser is needed here.
import { prisma } from '@noc/db';
import { SOCIAL_SETTING_KEYS, type SocialBrand } from '@noc/config';

/** The fixed page keys shown as a list on the SEO admin page. */
export const SEO_INTRO_PAGE_KEYS = ['home', 'market', 'explore'] as const;
export type SeoIntroPageKey = (typeof SEO_INTRO_PAGE_KEYS)[number];

export type SeoIntroValue = { ar: string; en: string };

/** Setting key for a page's SEO intro block. */
export function seoIntroSettingKey(pageKey: string): string {
  return `seo.intro.${pageKey}`;
}

function parseIntro(value: string | null | undefined): SeoIntroValue {
  if (!value) return { ar: '', en: '' };
  try {
    const p = JSON.parse(value) as Partial<SeoIntroValue>;
    return { ar: (p.ar ?? '').trim(), en: (p.en ?? '').trim() };
  } catch {
    return { ar: '', en: '' };
  }
}

/** Raw bilingual intro for a page key (both languages) — for the admin editors. */
export async function getSeoIntroRaw(pageKey: string): Promise<SeoIntroValue> {
  const row = await prisma.setting.findUnique({ where: { key: seoIntroSettingKey(pageKey) } });
  return parseIntro(row?.value);
}

/** Localized intro text for a page key (empty string when unset) — for public rendering. */
export async function getSeoIntro(pageKey: string, locale: 'ar' | 'en'): Promise<string> {
  const v = await getSeoIntroRaw(pageKey);
  return locale === 'ar' ? v.ar : v.en;
}

/** Batch: raw bilingual intros for several page keys (admin list). */
export async function getSeoIntros(pageKeys: readonly string[]): Promise<Record<string, SeoIntroValue>> {
  const keys = pageKeys.map(seoIntroSettingKey);
  const rows = await prisma.setting.findMany({ where: { key: { in: keys } } });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const out: Record<string, SeoIntroValue> = {};
  for (const pk of pageKeys) out[pk] = parseIntro(byKey.get(seoIntroSettingKey(pk)));
  return out;
}

/** Raw stored social-links text for a brand (for the admin textarea). */
export async function getSocialLinksRaw(brand: SocialBrand): Promise<string> {
  const row = await prisma.setting.findUnique({ where: { key: SOCIAL_SETTING_KEYS[brand] } });
  return row?.value ?? '';
}
