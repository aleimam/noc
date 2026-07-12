// Admin-editable global site settings for the New Obour portal: mobile menu mode,
// footer copyright (Arabic + English), slogan, and the WhatsApp "help" number.
// Stored as individual Setting rows.
import { prisma } from '@noc/db';

export type MobileMenuMode = 'full' | 'compact';

export type SiteConfig = {
  mobileMenuMode: MobileMenuMode; // full-screen overlay vs compact dropdown
  slogan: string; // New Obour brand slogan/tagline (footer) — Arabic
  sloganEn: string; // English slogan
  copyright: string; // New Obour footer copyright — Arabic
  copyrightEn: string; // English copyright
  whatsappHelp: string; // help/contact WhatsApp number ('' = hide the button)
  whatsappFloat: boolean; // show the floating WhatsApp button site-wide (uses whatsappHelp)
  whatsappFloatMsg: string; // optional pre-filled message ('' = no prefill)
};

export const SITE_KEYS = {
  mobileMenu: 'site.mobileMenu',
  slogan: 'site.slogan',
  sloganEn: 'site.slogan_en',
  copyrightNewobour: 'copyright_newobour',
  copyrightNewobourEn: 'copyright_newobour_en',
  copyrightAlsawarey: 'copyright_alsawarey',
  copyrightAlsawareyEn: 'copyright_alsawarey_en',
  whatsappHelp: 'site.whatsappHelp',
  whatsappFloat: 'whatsapp_float_newobour',
  whatsappFloatMsg: 'whatsapp_float_msg_newobour',
} as const;

export const DEFAULT_SLOGAN_NEWOBOUR = 'بوابة الخدمات المجانية';
export const DEFAULT_SLOGAN_NEWOBOUR_EN = 'Free services portal';
export const DEFAULT_COPYRIGHT_NEWOBOUR = '© بوابة خدمات مدينة العبور الجديدة';
export const DEFAULT_COPYRIGHT_NEWOBOUR_EN = '© New Obour City Services Portal';
export const DEFAULT_COPYRIGHT_ALSAWAREY = '© الصواري للاستثمار العقاري';
export const DEFAULT_COPYRIGHT_ALSAWAREY_EN = '© Al Sawarey Real-estate Investment';

export async function getSiteConfig(): Promise<SiteConfig> {
  try {
    const rows = await prisma.setting.findMany({
      where: { key: { in: [SITE_KEYS.mobileMenu, SITE_KEYS.slogan, SITE_KEYS.sloganEn, SITE_KEYS.copyrightNewobour, SITE_KEYS.copyrightNewobourEn, SITE_KEYS.whatsappHelp, SITE_KEYS.whatsappFloat, SITE_KEYS.whatsappFloatMsg] } },
    });
    const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return {
      mobileMenuMode: m[SITE_KEYS.mobileMenu] === 'compact' ? 'compact' : 'full',
      slogan: m[SITE_KEYS.slogan] || DEFAULT_SLOGAN_NEWOBOUR,
      sloganEn: m[SITE_KEYS.sloganEn] || DEFAULT_SLOGAN_NEWOBOUR_EN,
      copyright: m[SITE_KEYS.copyrightNewobour] || DEFAULT_COPYRIGHT_NEWOBOUR,
      copyrightEn: m[SITE_KEYS.copyrightNewobourEn] || DEFAULT_COPYRIGHT_NEWOBOUR_EN,
      whatsappHelp: m[SITE_KEYS.whatsappHelp] || '',
      whatsappFloat: m[SITE_KEYS.whatsappFloat] === '1',
      whatsappFloatMsg: m[SITE_KEYS.whatsappFloatMsg] || '',
    };
  } catch {
    return { mobileMenuMode: 'full', slogan: DEFAULT_SLOGAN_NEWOBOUR, sloganEn: DEFAULT_SLOGAN_NEWOBOUR_EN, copyright: DEFAULT_COPYRIGHT_NEWOBOUR, copyrightEn: DEFAULT_COPYRIGHT_NEWOBOUR_EN, whatsappHelp: '', whatsappFloat: false, whatsappFloatMsg: '' };
  }
}
