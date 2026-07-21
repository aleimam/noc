// Root loading boundary — MIRRORS the portal's. Without one a slow render left the previous
// page frozen with no sign of progress, which reads as "broken" on a weak mobile connection.
export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-8 text-center">
      <span className="h-10 w-10 animate-spin rounded-full border-4 border-ink-200 border-t-gold" aria-hidden="true" />
      <p className="text-base font-semibold text-navy-800">جارٍ التحميل…</p>
      <p className="text-sm text-ink-500">Loading…</p>
    </div>
  );
}
