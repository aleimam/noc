// Render-blocking inline script: applies the saved theme before first paint to
// avoid a flash of the wrong appearance. Defaults to the OS preference.
// Keep the cookie name in sync with ThemeToggle.
export function ThemeScript() {
  const js = `(function(){try{
var m=document.cookie.match(/(?:^|; )NOC_THEME=(light|dark)/);
var t=m?m[1]:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
if(t==='dark')document.documentElement.classList.add('dark');
}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}
