import sanitizeHtml from 'sanitize-html';

// Allow-list sanitiser for rich HTML that gets rendered via dangerouslySetInnerHTML
// (listing descriptions, pages, news, guide, geo-updates, building conditions). Keeps
// formatting + tables + images/links; strips scripts, event handlers, and javascript:.
// Applied server-side on SAVE so stored data is always clean (F2).
const OPTS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'hr', 'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'span',
    'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'caption',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'title'],
    span: ['style'],
    td: ['colspan', 'rowspan', 'style'],
    th: ['colspan', 'rowspan', 'style'],
    '*': ['dir'],
  },
  allowedStyles: {
    '*': {
      color: [/^#(?:[0-9a-fA-F]{3}){1,2}$/, /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/],
      'text-align': [/^(?:left|right|center|justify)$/],
      'font-size': [/^\d{1,3}(?:px|em|rem|%)$/],
      'font-weight': [/^(?:bold|normal|\d{3})$/],
    },
  },
  allowedSchemes: ['http', 'https', 'tel', 'mailto'],
  allowProtocolRelative: false,
  // External links open safely; never allow window.opener access or referrer leak.
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow', target: '_blank' }),
  },
};

/** Sanitise rich HTML before storage. Returns '' for empty/nullish input. */
export function sanitizeRichHtml(html: string | null | undefined): string {
  if (!html) return '';
  return sanitizeHtml(html, OPTS);
}
