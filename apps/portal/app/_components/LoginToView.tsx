import Link from 'next/link';

// Shown in place of a gated asset (scan / map) when the security posture requires login and
// the visitor isn't signed in. Presentation-only — callers pass already-localized copy.
export function LoginToView({ next, title, note, cta }: { next: string; title: string; note: string; cta: string }) {
  return (
    <div className="w-full rounded-2xl border-2 border-dashed border-gold/60 bg-gold-50 p-6 text-center">
      <div className="text-3xl" aria-hidden>
        🔒
      </div>
      <p className="mt-2 text-xl font-bold text-navy-800">{title}</p>
      <p className="mt-1 text-ink-600">{note}</p>
      <Link
        href={`/account/login?next=${encodeURIComponent(next)}`}
        className="mt-4 inline-block rounded-xl bg-navy-700 px-6 py-3 text-lg font-bold text-white"
      >
        {cta}
      </Link>
    </div>
  );
}
