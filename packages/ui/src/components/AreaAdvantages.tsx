// Grouped "Area advantages" block shown on a listing: City / District / Neighborhood
// advantages, each under the area's name. Presentational only — callers build the
// localized groups. Renders nothing when there are no advantages anywhere in the chain.
export function AreaAdvantages({ heading, groups }: { heading: string; groups: { title: string; items: string[] }[] }) {
  const shown = groups.filter((g) => g.items.length > 0);
  if (shown.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-navy-800 dark:text-soft">{heading}</h2>
      <div className="space-y-3">
        {shown.map((g, i) => (
          <div key={i} className="rounded-lg border border-graphite/15 p-3">
            <div className="mb-1 text-sm font-semibold text-primary">{g.title}</div>
            <ul className="list-disc space-y-1 ps-5 text-sm opacity-90">
              {g.items.map((t, j) => (
                <li key={j}>{t}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
