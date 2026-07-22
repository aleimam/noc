// Render-blocking inline script that GUARANTEES light appearance before first paint.
//
// The public sites are light-only since 2026-07-22 (owner decision). The «داكن» toggle was
// removed because a single accidental tap flipped the entire site for a low-literacy visitor who
// then had no idea what they'd done or how to undo it — the same reasoning that had already
// removed dark mode from the admin.
//
// This still runs rather than being deleted because visitors who used the old toggle carry an
// `NOC_THEME=dark` cookie with a ONE-YEAR max-age. It clears the class and expires the cookie,
// so those users heal on their next page load instead of being stuck dark until it lapses.
// Safe to delete once enough time has passed that no such cookies remain in the wild.
export function ThemeScript() {
  const js = `(function(){try{
document.documentElement.classList.remove('dark');
if(document.cookie.indexOf('NOC_THEME=')>-1){document.cookie='NOC_THEME=;path=/;max-age=0;samesite=lax';}
}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}
