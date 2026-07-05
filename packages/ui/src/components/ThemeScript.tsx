// Render-blocking inline script: applies the saved theme before first paint to
// avoid a flash of the wrong appearance. Keep the cookie name in sync with ThemeToggle.
//
// Rules (deliberate, per product decision):
//  - Admin (/admin*) is ALWAYS light — dark mode was removed there, so a dark cookie
//    set on the public site can never bleed into the admin panel.
//  - On the public sites dark mode is OPT-IN: it applies only when the visitor has
//    explicitly chosen it (NOC_THEME=dark). We intentionally do NOT follow the OS
//    `prefers-color-scheme`, because most of our low-literacy users browse on a
//    relative's phone that may be in dark mode — auto-dark made the site look broken
//    to people who never asked for it.
export function ThemeScript() {
  const js = `(function(){try{
if(location.pathname.indexOf('/admin')===0)return;
var m=document.cookie.match(/(?:^|; )NOC_THEME=(light|dark)/);
if(m&&m[1]==='dark')document.documentElement.classList.add('dark');
}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}
