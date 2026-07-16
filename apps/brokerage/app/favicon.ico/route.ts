// Browsers, crawlers and link-preview bots blindly request /favicon.ico — without this
// route it 404s (the real icon is the brand-managed /brand/favicon).
// Relative Location on purpose: behind nginx req.url is http://localhost:PORT, so an
// absolute redirect built from it would leak localhost (see CLAUDE.md landmine).
export function GET() {
  return new Response(null, { status: 308, headers: { Location: '/brand/favicon' } });
}
