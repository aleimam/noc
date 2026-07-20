# Codex Deep Audit Brief — NOC platform (newobour.com + alsawarey.com)

> Hand this file to Codex as the task brief. It is self-contained: Codex reads
> this + the repo. Run it as **repeated focused passes** (§9), not one giant
> sweep — one long session dilutes its own context and starts pattern-matching
> instead of reading.

---

## 0. Your job

Perform an exhaustive audit of a **live production** bilingual (Arabic/English)
platform and produce two things:

1. **Defects** — real bugs that corrupt data, leak information, break auth,
   lose a seller's work, or show users something wrong (engineering **and** UI/UX).
2. **Enhancements** — concrete, prioritized UI/UX improvements.

Depth over breadth. Do not stop early. A finding you cannot trace to a concrete
failure is not a finding.

---

## 1. Orientation — do this before judging any code

1. Read **`CLAUDE.md`** — the master doc: architecture, deploy runbook, server
   map, **Architecture rules** (the house invariants), feature map, current state.
   It is authoritative. Most "bugs" a naive reader would report are documented
   decisions in there.
2. Read **`AGENTS.md`** (short invariant list) and **`security.md`** (posture +
   findings register F1–F12).
3. Skim **`packages/db/prisma/schema.prisma`** for the domain model.
4. Run `npm install`, then `npx tsc --noEmit -p apps/portal` and
   `-p apps/brokerage` to learn the baseline before judging.

---

## 2. Stack facts — read these or you will file false positives

- **Turborepo monorepo → TWO Next.js 15 App Router apps sharing ONE MariaDB.**
  `apps/portal` = newobour.com (community portal **and** the single `/admin` that
  manages *both* brands). `apps/brokerage` = alsawarey.com (display-only storefront).
- **Prisma 7, pure-JS client** (no query engine binary), generated into
  `packages/db/generated`. **Migrations are hand-written SQL** with PascalCase
  table names — prod MySQL is case-SENSITIVE. `VARCHAR(191)`, `DATETIME(3)`, utf8mb4.
- **Auth.js v5 beta**; RBAC via `requirePermission(section, action)` over **12
  section keys** (see `packages/config` SECTIONS).
- **next-intl, Arabic-first with full RTL.** Admin defaults to English; public +
  brokerage default to Arabic (cookie wins).
- Shared packages: `db, auth, ui, partner-portal, mail, sms, analytics, config, i18n`.
- **🌟 GOLDEN RULE — the design constraint that outranks convention:** users are
  **low-literacy / low-tech, mostly on a relative's phone**. Design biggest /
  simplest / most explicit, mobile-first. An icon-only control with no word, a
  <40px tap target, or an error that doesn't say what to do next **is a defect
  here**, not a nitpick.
- **You cannot run the apps** (no MariaDB, no `.env`). Do UI review statically
  from components + Tailwind classes + `packages/i18n/messages/*.json`. If you
  look at the live public sites, **do not authenticate, submit forms, or post**.

---

## 3. Hard constraints

- **READ-ONLY.** Do not modify source, commit, push, deploy, or run migrations.
- Never touch `.env`, the production database, or the server (`ssh noc`).
- Never read or copy anything under `uploads/` (real user/customer images).
- Only local read-only commands (typecheck, grep, analysis scripts).

---

## 4. Part A — Engineering audit

### The house invariants — violations are REAL bugs, hunt them first

1. **Three mirrored file pairs must stay byte-equivalent in behaviour** (kept in
   sync by discipline only, no build guard). **Diff each pair line by line:**
   - `apps/{portal,brokerage}/lib/search.ts`
   - `apps/{portal,brokerage}/app/thumb/[...path]/route.ts`
   - `apps/{portal,brokerage}/app/api/listings/alive/route.ts`
2. **Soft delete**: every public listing read must exclude `deletedAt != null`.
   The central gates are `newObourVisibility()` / `alsawareyVisibility()` in
   `packages/partner-portal/src/visibility.ts`. **Any direct `prisma.listing`
   query** (admin lists, counts, sitemaps, aggregates, exports) must add the
   filter itself. Also verify the purge transaction is identical in the admin
   `purgeListing` action **and** `ops/purge-deleted-listings.ts`.
3. **EAV SELECT reads must fall back `listItem ?? option`.** Since the option-list
   migration, values live in `listItemId`; legacy rows still carry `optionId`.
   Reading only one silently drops data (this exact bug erased city/district from
   storefront cards and the search haystack once).
4. **Required listing details — FOUR enforcement sites must agree**:
   `apps/portal/app/account/listings/{ListingForm.tsx,actions.ts}` and
   `packages/partner-portal/src/{LeanListingForm.tsx,listingSave.ts}`, plus the
   admin guards in `marketplace/actions.ts`. Invariants: **publish (PENDING) only**
   — DRAFTs may stay incomplete; only attributes **applicable** to the chosen
   Type/Purpose/Condition are demanded; boolean `false` **counts as answered**;
   **PHOTOS/DOCUMENTS can never be required** (attachment-backed, invisible to the
   value checks — requiring one soft-locks publishing).
5. **AuthZ**: every admin route **and** every server action permission-gated
   server-side, not merely hidden in the UI. Hunt IDOR: partners/customers
   reaching another owner's listing, order, or attachment.
6. **Rate limits** on public write endpoints (`lib/rateLimit.ts` per app,
   X-Real-IP-trusting). Convention: page-render log writes ~20/min/IP, beacons
   ~60/min/IP, lead forms per-IP + global ceiling + dedupe + honeypot.
7. **Reverse-proxy redirect landmine**: behind nginx `req.url` is
   `http://localhost:PORT`. Never build an absolute redirect from it — use
   `PORTAL_URL`/`BROKERAGE_URL` or a relative `Location`. Any absolute redirect
   derived from the request leaks localhost to users.
8. **Shared-package client/server split**: a package barrel may export only
   client-safe things; anything importing Prisma must live under a `/server`
   subpath. A Prisma import reaching a client bundle breaks the build with
   `Can't resolve 'fs'/'tls'/'net'`.
9. **Tailwind `@source`**: every shared package with Tailwind classes must be
   listed in BOTH apps' `app/globals.css`, or its classes silently purge.

### Then, in priority order

**P0 — data integrity, money, security**
- Listing lifecycle: status transitions (DRAFT→PENDING→PUBLISHED/REJECTED/SOLD),
  effects running exactly once, the auto-save-as-draft path (must never demote a
  PENDING/PUBLISHED listing, must never duplicate a listing — check `draftIdRef`).
- Price handling: `price`, `soldPrice`, `lowestPrice` (admin-only — **must never
  reach any public surface**), `priceUnit`, 0/blank → "on request" normalisation.
- Rationing: Excel import dedup (in-file vs server), `dedupeKey` correctness,
  scan↔row matching, watcher matching + SMS sending (must stamp only on success).
- Uploads: path traversal, extension/MIME validation, the stamping pipeline
  preserving the pure original, attachment ownership checks.
- Secrets: anything in code, logs, or client bundles; the OTP flow; session gates.

**P1 — user-visible wrongness**
- Concurrency: double-submit, moderation race, cron reentrancy.
- Query correctness: wrong status basis, off-by-one windows, timezone drift,
  aggregates silently excluding rows.
- Error handling: swallowed errors, "best-effort" paths hiding real failures.

**P2 — latent**
- Performance: N+1 Prisma queries on public pages, unbounded `findMany`, missing
  indexes on hot filters, memory blowups in imports (Excel with 1000s of rows).
- Drift: the two apps diverging, docs contradicting code, duplicated logic.

---

## 5. Part B — UI/UX audit (defects **and** enhancements)

### B1. RTL & bilingual correctness — highest-yield area in this codebase
- Directional utilities must be **logical**: `ms-/me-/ps-/pe-/start-/end-/
  text-start/text-end`, **not** `ml-/mr-/pl-/pr-/left-/right-/text-left/text-right`
  (or must carry an `rtl:` variant).
- **Directional icons must flip** — chevrons, arrows, "back" affordances.
- `packages/i18n/messages/ar.json` vs `en.json`: missing keys, orphan keys,
  untranslated/placeholder Arabic, English leaking into AR strings.
- Hardcoded user-facing text in components that bypasses `t()` / the `L(ar, en)`
  helper. (Note: inline `L('عربي', 'English')` **is** an accepted house pattern —
  only flag text with no English counterpart, or the reverse.)
- Locale-correct numerals, dates, currency. Placeholders must read RTL in Arabic
  (there is a global CSS rule for this — verify nothing defeats it).

### B2. The GOLDEN RULE — audit against the real audience
- **Icon-only controls are a defect** unless paired with a word. (Search buttons
  were changed from 🔍-only to an explicit «بحث» for exactly this reason.)
- **Tap targets ≥40px**; inputs **16px** font (smaller triggers iOS focus-zoom).
- Required fields must be marked with an explicit word («مطلوب»), not just colour
  or an asterisk.
- Errors must say **what to do next** in plain Arabic, not just what failed.
- Destructive actions must confirm; work must never be lost on a validation failure.

### B3. Responsive
- Audit **320 / 375 / 768 / 1024 / 1440**.
- **No element may expand the page** — wide content (tables, posters, maps) scrolls
  inside its own `overflow-x:auto` container.
- Admin sidebar behaviour at ≤lg; drawers/modals on small screens; sticky headers
  must not cover content.

### B4. Accessibility (target WCAG AA)
- **Keyboard**: every control reachable and operable; a visible `:focus-visible`
  ring distinct from hover; logical order; no traps (check the Lightbox/gallery).
- **Semantics**: real `<table>` headers with `scope`, buttons vs links used
  correctly, labels tied to inputs, sane heading hierarchy.
- **ARIA**: accessible names on icon-only buttons, `aria-current`, `role="status"`
  for async feedback.
- **Never colour-only meaning** (status badges, required markers) — pair with text.
- Images: meaningful `alt` (listing photos carry geo-rich alt by design);
  decorative images `aria-hidden`.

### B5. State coverage
For **every** page and panel verify all five exist and are correct:
**loading · empty · error · success · permission-denied.** Empty states should
guide the user, not dead-end them.

### B6. Flow-level UX — walk these end-to-end
- **Public (newobour.com)**: home → market browse/search/filter → listing detail
  (hero gallery, poster, maps) → contact/WhatsApp. Also: rationing name search →
  result → follow/notify; `/explore` geo drill-down; `/calculator`.
- **Storefront (alsawarey.com)**: home → listings → detail → buy/contact →
  customer OTP login → wishlist.
- **Partner portal** (both sites): login (password **or** OTP) → إعلاناتي →
  add/edit listing (lean form) → price/availability fast-edit → عروض الصواري.
- **Admin daily**: moderation queue (PENDING→PUBLISHED/REJECTED), create/edit a
  listing (the long form), rationing import + scan reconciliation, watchers
  follow-up, backups page.
- For each report: friction, dead ends, unclear errors, unconfirmed destructive
  actions, lost work, missing feedback after an action.

### B7. Content & microcopy
- Consistent presentation of currency, area (م²), dates, plot references.
- Trust signals where they matter (contact, official papers, area maps).

---

## 6. Do NOT report — these are deliberate decisions

- **Poster card order** (`POSTER_CARD_ORDER`) and the listing-form field order —
  both owner-set after several iterations. Report genuine breakage only, never a
  reshuffle.
- **Partner listings appear on BOTH public sites** regardless of the partner's
  `siteNewObour`/`siteAlsawary` flags — those gate **login only** (owner decision).
- `Listing.cardTitle` is a **dormant retired column**; `Setting` has `key` as its
  PK with no `id` column; `Order`-style tables may lack columns you expect.
- **`/news` and `/guide` returning 404** — those modules are toggled OFF in
  Settings → Modules. Same for `/price-index` (hidden behind its toggle).
- **Arabic-only content where admin English fields are empty** — EN content entry
  is a pending owner task, not a bug.
- Restore is **CLI-only** by design; `db:release` **never** seeds; pm2 runs as root
  (accepted trade-off on this CWP box); both apps bind `127.0.0.1` on purpose.
- Neighborhood map **inheritance is explore-only**, never on listings.
- Transfer fee **180/م²** and requiring **both** areas for the reconcile auto-fill.
- The gallery "ask about this photo" WhatsApp button was **deliberately deleted**.
- Settings `gsc_newobour` / `gsc_alsawarey` must never be removed (Search Console).
- Style/formatting nits, "consider adding a test", or restating what the code does.
- Anything you have not traced to a concrete failure.

---

## 7. Method — this is what makes it deep

- Work **one domain at a time**. For each: read the service → then **every caller**
  → then the docs' claims about it, before judging.
- **Trace data end-to-end**: where a bad value enters → how it flows → where it
  does damage.
- Before reporting, actively try to **disprove** it: find the guard, the
  caller-side check, the documented decision. Discard what cannot fail in practice.
- Write temporary analysis scripts if they help you prove something.
- **Loop** until two consecutive passes over a domain surface nothing new.

---

## 8. Report format

Write **`CODEX_AUDIT_FINDINGS.md`** with three sections.

### Section 1 — Defects (sorted by severity)
```
### [P0|P1|P2] <one-line defect statement>
- Confidence: CONFIRMED (traced) | SUSPECTED (needs human check)
- Type: engineering | ui-ux
- Location: path/to/file.ts:LINE (+ other involved files)
- What's wrong: 1–3 sentences — the mechanism, not a description
- Failure scenario: concrete inputs/state → the wrong output or damage
- Suggested fix: specific and minimal
- Blast radius: who/what is affected in production
```

### Section 2 — UI/UX enhancements (sorted by impact ÷ effort)
```
### <enhancement title>
- Problem it solves: (observed friction, not a preference)
- Proposed change: concrete and specific
- Serves the GOLDEN RULE? how it helps a low-literacy phone user
- Expected impact: who benefits and how
- Effort: S | M | L
```

### Section 3 — Coverage log
Every file/domain you actually reviewed and what you concluded — **including
areas you checked and found clean.** This is how we know what wasn't looked at.

---

## 9. The pass plan — run each as a SEPARATE session

Same brief every time; change only the `THIS PASS` line.

| # | `THIS PASS:` |
|---|---|
| 1 | listings + EAV — `ListingForm`, `catalog.ts`, `actions.ts`, required-details (4 sites), auto-save-draft, price fields |
| 2 | soft delete + public visibility — every `prisma.listing` read across both apps, sitemaps, counts, purge |
| 3 | partner portal — auth, ownership scoping/IDOR, lean form, `listingSave.ts`, fast-edit actions |
| 4 | admin RBAC — every route under `/admin` and every action in `apps/portal/app/admin/**/actions.ts` |
| 5 | rationing — import dedup, `dedupeKey`, scans reconciliation, watchers + SMS, quotas |
| 6 | geo / lands — explore pages, maps + annotator, inheritance matrix, area derivation |
| 7 | search intelligence + public endpoints — `lib/search.ts` mirrors, suggest/lead/event routes, rate limits |
| 8 | media pipeline — uploads, stamping/watermark, poster generation, `/thumb` mirrors, attachments |
| 9 | analytics + ops — collector, rollup/prune crons, `ops/*.ts` scripts, backups module |
| 10 | performance + schema — N+1, unbounded queries, indexes, imports at scale |
| 11 | security sweep — headers/CSP, uploads, injection, secrets, session/OTP, sanitisation |
| 12 | **UI/UX: RTL + i18n** (§B1) — sweep every component and both message files |
| 13 | **UI/UX: public sites** (§B2–B6) — golden rule, responsive, a11y, states, visitor flows |
| 14 | **UI/UX: admin + partner** (§B2–B6) — operator flows, responsive, a11y, states |
| 15 | **UI/UX: enhancements synthesis** — turn passes 12–14 into Section 2 |

---

## 10. Definition of done

- Every pass produced findings **with traces**, plus a coverage log.
- Findings merged, de-duplicated, and severity-sorted into one
  `CODEX_AUDIT_FINDINGS.md`.
- Anything you could not verify is explicitly marked **SUSPECTED**, not asserted.
- You state plainly what you did **not** get to.
