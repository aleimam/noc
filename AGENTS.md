# Agent onboarding (any AI agent: Codex, Claude, etc.)

**Read `CLAUDE.md` first — it is the master onboarding doc** for this repo (architecture, repo
map, production server map, architecture rules, feature map, current state). Everything in it
applies to you regardless of which agent you are. Supporting docs: `security.md` (security
posture + findings register), `HANDOFF.md` (session-transition state), `ops/README.md` (server
scripts + crons), `ROADMAP.md` (feature history).

Facts that matter for automated review/work:

- Two production Next.js 15 apps (`apps/portal` = newobour.com, `apps/brokerage` = alsawarey.com)
  share one MariaDB via Prisma 7 (pure-JS client). Arabic-first, RTL, low-literacy mobile users.
- You cannot run the apps without a MariaDB + `.env` (not in the repo). `npm install` then
  `npx tsc --noEmit -p apps/portal` / `-p apps/brokerage` works for static checking.
- Migrations are hand-written SQL (PascalCase table names — prod MySQL is case-sensitive).
  Never add seeding to the release path.
- House invariants (violations are real bugs): the three mirrored file pairs
  (`apps/{portal,brokerage}/lib/search.ts`, `apps/{portal,brokerage}/app/thumb/[...path]/route.ts`,
  `apps/{portal,brokerage}/app/api/listings/alive/route.ts`) must stay identical; every public
  listing read must respect soft delete (`deletedAt: null`, via the visibility helpers in
  `packages/partner-portal/src/visibility.ts`); public write endpoints are rate-limited;
  EAV SELECT value reads must fall back `listItem ?? option`; admin server actions call
  `requirePermission(...)`; partners may only touch their own listings; never build absolute
  redirects from `req.url` (reverse proxy); shared packages must not leak Prisma into client
  bundles (server-only code lives under `/server` subpath exports).
