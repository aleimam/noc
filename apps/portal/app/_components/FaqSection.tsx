// Visible FAQ accordion (details/summary). MUST render the same Q&As emitted as FAQPage
// JSON-LD on the page (Google requires visible parity). Server component; content-only.

export function FaqSection({ title, items }: { title: string; items: { q: string; a: string }[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mx-auto max-w-3xl space-y-3">
      <h2 className="text-xl font-extrabold text-navy-800 dark:text-soft">{title}</h2>
      <div className="divide-y divide-ink-200 overflow-hidden rounded-2xl border border-ink-200 bg-white dark:border-navy-700 dark:bg-navy-900">
        {items.map((it, i) => (
          <details key={i} className="group px-4 py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-lg font-bold text-navy-800 dark:text-soft">
              <span>{it.q}</span>
              <span className="flex-none text-gold transition-transform group-open:rotate-45" aria-hidden>+</span>
            </summary>
            <p className="mt-2 whitespace-pre-line leading-relaxed text-ink-700 dark:text-ink-300">{it.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
