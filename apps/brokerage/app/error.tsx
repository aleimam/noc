'use client';

// Root error boundary — MIRRORS the portal's. Gives the two obvious recovery actions in plain
// Arabic (English underneath) instead of Next's generic fallback.
import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('brokerage route error', error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-4xl" aria-hidden="true">⚠️</p>
      <h1 className="text-xl font-bold text-navy-800">حدث خطأ غير متوقع</h1>
      <p className="text-sm text-ink-600">لم نتمكن من عرض هذه الصفحة. جرّب مرة أخرى، أو ارجع للصفحة الرئيسية.</p>
      <p className="text-xs text-ink-500">Something went wrong. Try again, or go back home.</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button onClick={reset} className="min-h-11 rounded-md bg-navy-800 px-5 py-2 text-sm font-bold text-soft">
          إعادة المحاولة / Try again
        </button>
        <a href="/" className="min-h-11 rounded-md border border-navy-800 px-5 py-2 text-sm font-bold text-navy-800">
          الصفحة الرئيسية / Home
        </a>
      </div>
    </div>
  );
}
