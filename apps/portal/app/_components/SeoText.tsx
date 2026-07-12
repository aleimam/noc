// Muted, SEO-oriented body text rendered below a page H1. Plain text only (React-escaped);
// never HTML. `SeoIntro` = the optional admin-authored intro; `GeoSummary` = the
// auto-generated data summary. Both no-op when empty.

export function SeoIntro({ text }: { text?: string | null }) {
  const t = (text ?? '').trim();
  if (!t) return null;
  return <p className="max-w-3xl whitespace-pre-line text-sm leading-relaxed text-ink-600 dark:text-ink-300">{t}</p>;
}

export function GeoSummary({ text }: { text?: string | null }) {
  const t = (text ?? '').trim();
  if (!t) return null;
  return <p className="max-w-3xl text-sm leading-relaxed text-ink-500 dark:text-ink-400">{t}</p>;
}
