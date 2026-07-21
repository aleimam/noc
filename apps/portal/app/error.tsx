'use client';

// Root error boundary. Without one, an uncaught render/server error fell through to Next's
// generic recovery screen — no words the audience can act on and no way back. Gives the two
// obvious actions (retry, go home) in plain Arabic with English underneath.
import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('portal route error', error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-4xl" aria-hidden="true">⚠️</p>
      <h1 className="text-xl font-bold text-primary">حدث خطأ غير متوقع</h1>
      <p className="text-sm opacity-80">
        لم نتمكن من عرض هذه الصفحة. جرّب مرة أخرى، أو ارجع للصفحة الرئيسية.
      </p>
      <p className="text-xs opacity-60">Something went wrong. Try again, or go back home.</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={reset}
          className="min-h-11 rounded-md bg-primary px-5 py-2 text-sm font-bold text-soft"
        >
          إعادة المحاولة / Try again
        </button>
        <a href="/" className="min-h-11 rounded-md border border-primary px-5 py-2 text-sm font-bold text-primary">
          الصفحة الرئيسية / Home
        </a>
      </div>
    </div>
  );
}
