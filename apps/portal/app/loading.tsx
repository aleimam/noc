// Root loading boundary. Neither app had one, so a slow server render showed the previous page
// frozen with no indication anything was happening — on a weak mobile connection that reads as
// "broken", and people tap again or leave. Bilingual + role="status" so it is announced.
export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-8 text-center">
      <span className="h-10 w-10 animate-spin rounded-full border-4 border-graphite/20 border-t-primary" aria-hidden="true" />
      <p className="text-base font-semibold text-primary">جارٍ التحميل…</p>
      <p className="text-sm opacity-70">Loading…</p>
    </div>
  );
}
