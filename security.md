# Security Standard — NOC Platform

**Scope:** New Obour portal (`newobour.com`) and ALSWARY storefront (`alsawarey.com`),
their shared packages, database, and hosting.
**Audience:** the platform owner/admin and anyone deploying or extending the system.
**Rule:** treat this file as binding. Re-read §5 (Procedures) on every deploy and whenever
a new endpoint, upload path, or public data view is added.

_Last reviewed: 2026-07-03._

---

## 1. Principles

1. **Assume the browser is hostile.** Anything sent to a visitor can be read, saved, and
   replayed. Design so that being copied *once* is survivable and being copied *in bulk*
   is impractical.
2. **Protect the crown jewels, not the pixels.** The catastrophe is losing the **database,
   the original files, or an admin account** — not someone screenshotting one sheet. Spend
   effort there first.
3. **Deny by default.** Every write and every non-public read is denied until an explicit
   permission or ownership check allows it.
4. **Don't punish the mission.** The public rationing service is free and built for
   low-literacy users on borrowed phones. Security must not add friction that breaks that
   (no right-click blockers, no captchas on search, no dev-tools traps — they don't work
   and they hurt real users).
5. **Defence in depth.** App checks + edge/WAF + server config + database least-privilege +
   backups. No single layer is trusted alone.

### The honest limit

**You cannot make publicly-viewable data impossible to copy.** If the page renders it, the
data is already on the visitor's device. What is achievable is making *bulk* extraction
**slow, costly, detectable, and watermarked**, while making *total compromise* genuinely
hard. Everything below serves those two achievable goals — never the impossible one.

---

## 2. Data classification

| Class | Examples | Handling |
|---|---|---|
| **Secret** | `AUTH_SECRET`, SMS-gateway creds, DB password, session cookies | Server-only. Never in `NEXT_PUBLIC_*`, never in git, `.env` = `chmod 600`. Rotate on any leak or staff change. |
| **Sensitive PII** | Rationing applicant names + plots, owner phone numbers/notes, customer phones | Minimum public exposure. Owner contact data is **never** sent to the storefront client. Bulk access is gated + throttled. |
| **Proprietary media** | Source scans, district/masterplan maps | Public copies are **always watermarked**; the clean original stays private and is never served publicly. |
| **Public** | Search matches, listing summaries, guide/news content | Open, but still rate-limited and pagination-capped to stop scraping. |

The whole dataset is the product of significant effort; the posture in §3 exists to keep it
that way.

---

## 3. Data-access posture — `security.level` (admin-switchable)

A single backend setting (`Setting` key **`security.level`** ∈ `LIGHT | MEDIUM | HIGH`,
default **MEDIUM**) governs how hard we throttle the rationing register. It is read via
`getSecurityLevel()` / `getSecurityGates()` and changed from **Admin → System → Security**
with no redeploy. **New Obour only — Al Sawarey has no browsing/data quota.**

Product decision: keep everything **open to everyone** (no login wall for browsing) and deter
bulk-copying by **metering rationing usage per visitor per hour**. A "rationing event" = a new
search (page 1) or opening a record; the two share the hourly budget. Anonymous visitors are
metered per **browser** (a first-party `nob_v` cookie set in middleware) with a generous
per-**IP** ceiling on top — the ceiling is high on purpose so many real users behind one
mobile carrier IP (CGNAT, the norm in Egypt) never trip it, while a single scraper looping
with cleared cookies still gets caught. Logged-in customers get a much larger budget.

| Capability | LIGHT | **MEDIUM** (default) | HIGH (break-glass) |
|---|---|---|---|
| Rationing **search** + record **detail** | public | public | public |
| High-res **source scans** | public + watermark | public + watermark | **login + watermark** |
| District / neighborhood **maps** | public + watermark | public + watermark | **login + watermark** |
| Marketplace (both sites) | unlimited | unlimited | unlimited |
| Anon rationing events / hour (per browser) | 30 | **10** | 5 |
| Logged-in rationing events / hour | 200 | 100 | 60 |
| Per-IP hourly ceiling (CGNAT safety net) | 300 | 150 | 60 |
| Max results per request | 50 | 50 | 25 |

Over budget → a friendly card (log in for more, or wait) instead of results/record. **HIGH** is
a temporary break-glass for a live scraping incident: it additionally re-enables a login wall on
scans + maps. Al Sawarey and all non-rationing New Obour surfaces (explore browse, guide,
calculator, marketplace) are never metered.

**Always on, every level:**
- No public **bulk or export** endpoint — exports are staff-only and permission-gated.
- Public media is **watermarked**; originals never public.
- Anti-abuse limits on OTP + uploads run regardless of level (not "browsing" limits).
- Raising the level takes effect immediately for new requests.

---

## 4. Controls

### 4.1 Authentication & authorization
- Every server action / route handler that **writes**, or reads **non-public** data, calls
  `requirePermission(section, action)` (staff) or verifies `auth()` **plus row ownership**
  (customer). Client-supplied role/id is never trusted.
- **RBAC model (2026-07 restructure):** 12 purpose-built section keys × 5 actions
  (VIEW/CREATE/UPDATE/DELETE/MANAGE; MANAGE implies all): `sheets`, `lands`, `listings`,
  `catalog`, `owners`, `storefront`, `content`, `appearance`, `analytics`, `staff`,
  `customers`, `settings` (system-only). The old god-sections were split — `marketplace` →
  listings/catalog/owners/storefront, `settings` spun off appearance + analytics — and
  news/guide/pages merged into `content`. Migration `20260712160000_rbac_sections` copied
  every existing role/user grant onto the new keys before deleting the old Permission rows
  (zero-lockout, no URL changes).
- **IDOR guard:** any by-id customer operation confirms the row's `userId` / `sellerId`
  equals the session user, else STAFF. Applies to listings, follows, lands, offers.
- Staff area sits behind middleware; the cross-app "view ALSWARY as admin" token is HMAC-
  signed over `AUTH_SECRET`, time-limited (8 h), and verified with a timing-safe compare.

### 4.2 Output encoding — no stored XSS
- Any value rendered with `dangerouslySetInnerHTML` **must** be sanitised server-side with
  an allow-list sanitiser (`sanitize-html`) **before storage**. Covers listing
  `description` (customer-authored — untrusted), and page / news / guide / geo-update /
  building-condition bodies. Allow formatting + tables; strip scripts, event handlers,
  `javascript:` URLs, iframes.

### 4.3 Input validation
- Validate type, length, and range on every action input; normalise phones; cap payload
  size. Queries go through Prisma only — never string-built SQL.

### 4.4 Rate limiting
- Per-IP **and** per-identity limits on: staff login, OTP request, OTP verify, public
  search, `/api/upload`, and contact / lead / offer / follow submissions. Trip → HTTP 429.
- App-level limiter is the inner layer; the **edge (Cloudflare/WAF) is the primary** line
  (§4.7).

### 4.5 File handling
- Sniff **magic bytes**, not the client-declared type (already done); enforce the 32 MB
  cap; randomise filenames; **reject SVG**.
- Store the **pure original privately**; publish only the watermarked/stamped rendition.

### 4.6 Secrets, sessions, headers
- `AUTH_SECRET`: strong random ≥32 bytes in prod; the app must **refuse to start** (throw)
  on a missing/weak secret in production — no silent dev fallback.
- Cookies: `httpOnly` + `Secure` + `SameSite=Lax`; short TTL; sign-out clears the session.
- Both apps send (in `next.config.mjs`, implemented): `Content-Security-Policy`,
  `X-Frame-Options: SAMEORIGIN` + CSP `frame-ancestors 'self'` (single-origin apps — blocks
  all cross-site framing = clickjacking), `X-Content-Type-Options: nosniff`, `Referrer-Policy:
  strict-origin-when-cross-origin`, `Strict-Transport-Security`, `Permissions-Policy`.
- The CSP keeps `script-src`/`style-src` `'unsafe-inline'` (Next injects inline bootstrap
  without a nonce) and allow-lists only GA4 + Meta Pixel; `'unsafe-eval'` and
  `upgrade-insecure-requests` are **prod-only** (dev keeps Turbopack HMR working). CSP here is
  defence-in-depth — the real XSS vector is closed at the source by `sanitizeRichHtml` (§4.2).

### 4.7 Edge / network (primary anti-scrape + DDoS layer)
- **Cloudflare** in front of both domains: Bot Fight Mode, WAF managed rules, edge rate-
  limiting, and hotlink/referrer rules for `/uploads/*`.

### 4.8 Dependencies & logging
- `npm audit` before every release; patch High/Critical promptly; keep Next.js / Prisma /
  next-auth current.
- Log auth failures, 429s, permission-denials, and admin-token mints; alert on spikes
  (scraping / brute-force signal).

---

## 5. Infrastructure standard (server / proxy / DB / OS)

**Nginx (prod web server — Apache/httpd is down on this box)** — reverse proxy in
`/etc/nginx/conf.d/noc.conf`. In prod, `/uploads/*` is served **by the portal's own Next
route** (`app/uploads/[...path]/route.ts` — `/root` isn't readable by the web-server user;
the brokerage proxies `/uploads` to :3001), so the app-level Referer hotlink guard in that
route **is the active protection**, not a mirror.
- If uploads ever move to being served directly by Nginx, apply the equivalent edge rule:
  ```nginx
  location /uploads/ {
    valid_referers none blocked newobour.com *.newobour.com alsawarey.com *.alsawarey.com;
    if ($invalid_referer) { return 403; }
    autoindex off;
  }
  ```
- Force HTTPS + **HSTS**; TLS 1.2+ only; never expose the Next.js ports (3001/3002) directly.
- CWP gotcha: bind server blocks to the **specific IP** (`listen 77.42.66.76:443 ssl;`) —
  CWP's wildcard `default_server` hijacks bare `listen 443 ssl` blocks.

**Secrets / env**
- `AUTH_SECRET` must be a strong random value (`openssl rand -base64 32`); it signs sessions,
  the cross-app admin token, and OTP hashes. The app **refuses to start signing in production**
  if it is missing or < 16 chars (F7) — no silent dev fallback. Rotate on staff offboarding
  or suspected leak.

**MariaDB**
- App connects as a **least-privilege** user (DML only — no `DROP`/`GRANT`/`FILE`), never
  root. Bind to `127.0.0.1`; 3306 closed at the firewall. Strong, rotated password.
- **Automated encrypted off-server backups** (nightly `mysqldump` → encrypt → offsite).
  **Test a restore quarterly.** Backups are the real insurance against ransomware *and*
  "someone copied everything."

**OS / SSH**
- SSH **key-only** (disable password login — the server currently logs dozens of failed
  password attempts), `fail2ban` on, firewall allows only 80/443/SSH.
- Patch OS/CWP; run apps + PM2 as a **non-root** user with log rotation.
- `.env` `chmod 600`, owned by the app user, never committed.

**Hardening round 3 — attack-surface reduction (applied 2026-07-11, all verified)**
- **pure-ftpd removed** (stopped + disabled; ports 20/21 closed in CSF). FTP had *never* been
  used and was under active brute-force at the time of removal.
- **BIND/named removed** (stopped + disabled; 53/853 closed in CSF TCP+UDP). All domains'
  authoritative DNS is Cloudflare; the system resolves via the host provider's resolvers —
  named served nothing.
- **CSF TCP_IN trimmed** to `22,25,80,110,143,443,465,587,993,995` + CWP panel ports
  (2030–2096 kept deliberately — they are the lockout-recovery path). UDP_IN = `80,443`.
- **TLSv1.3 enabled** alongside 1.2 (nginx.conf + CWP host vhosts); **`server_tokens off`**
  (version no longer disclosed).
- **Next.js bound to localhost** — `next start -H 127.0.0.1` in both apps' start scripts, so
  :3001/:3002 no longer listen on public interfaces at all (previously firewall-blocked only).
- `.env` tightened to `600` (was 644).
- **Kernel reboot DONE 2026-07-11** (owner-approved): running `5.14.0-687.23.1`,
  `needs-restarting -r` clear; all services + pm2 apps returned unattended (~90s downtime).
- **Still open (accepted):** apps run under pm2 as **root** (CWP box convention; a non-root
  migration is possible but touchy — revisit after the Cloudflare cutover). CSF
  `RESTRICT_SYSLOG` left at CWP default. Both are conscious trade-offs, not oversights.

---

## 6. Procedures

**Every deploy**
- [ ] `npm audit` — no unresolved High/Critical.
- [ ] Both apps build + typecheck green.
- [ ] New action/route has permission + ownership checks.
- [ ] New `dangerouslySetInnerHTML` renders **sanitised** HTML only.
- [ ] New upload/download surface enforces MIME + size + original-privacy.
- [ ] New public data view is wired to `getSecurityLevel()` and pagination-capped.
- [ ] Schema change → `db:release` run.

**Monthly**
- [ ] Review auth-failure / 429 logs for scraping / brute-force.
- [ ] Verify backups ran; perform a test restore.
- [ ] `npm outdated` → plan Next/Prisma/next-auth updates.

**On incident (suspected scrape or breach)**
- [ ] Set `security.level = HIGH` from the backend (instant throttle + login-gate).
- [ ] Block offending IPs/ASNs at Cloudflare/Apache.
- [ ] Rotate `AUTH_SECRET` + SMS creds; force staff re-login.
- [ ] Review DB access logs; restore from a clean backup if integrity is in doubt.

---

## 7. Findings register

From the review; severities Critical / High / Medium / Low. Update **Status** as fixed.

| # | Sev | Finding | Status |
|---|-----|---------|--------|
| F1 | High | No rate limiting (login / OTP / search / upload / submissions) | **fixed (3a)** — `lib/rateLimit` on OTP, uploads, public search |
| F2 | High | Listing `description` (and all rich text) rendered as raw HTML → stored XSS | **fixed (3a)** — `sanitizeRichHtml` at write-time; DB backfill pending |
| F3 | Med | No security headers / CSP on either app | **fixed (3c)** — CSP + HSTS + nosniff + frame/referrer/permissions in both `next.config.mjs` |
| F4 | Med | `/uploads` lacks hotlink protection / throttle | **fixed (3c)** — app-level Referer guard + concrete Apache edge rule (§5) |
| F5 | Med | Heavy uncapped public queries (name pool 8000, browse 3000) | **fixed (3b)** — page size + per-IP rate scale with posture; lists bounded |
| F6 | Med | Full sheet / scans / maps not gated at MEDIUM posture yet | **fixed (3b, revised)** — data kept fully open; per-visitor hourly quota (cookie+IP, New Obour only) deters bulk copy; HIGH break-glass re-gates scans/maps (§3) |
| F7 | Low | `AUTH_SECRET` dev fallback must be impossible in prod | **fixed (3c)** — `appSecret()` throws in prod if unset/weak |
| F8 | Low | OTP throttled per-phone only, not per-IP | **fixed (3a)** — per-IP cap added on both apps |
| F9 | Med | pure-ftpd running + port 21 open (unused, under live brute-force) | **fixed (round 3)** — service disabled, 20/21 closed |
| F10 | Med | BIND/named exposed on public :53 with no delegated zones | **fixed (round 3)** — service disabled, 53/853 closed |
| F11 | Low | TLSv1.2-only; nginx version disclosed in Server header | **fixed (round 3)** — TLSv1.3 enabled; server_tokens off |
| F12 | Low | Next.js listened on 0.0.0.0:3001/3002 (firewall-blocked but public-bound); `.env` was 644 | **fixed (round 3)** — bound to 127.0.0.1; `.env` 600 |

---

_Pragmatic by design: individual items may be copied; effort concentrates on preventing
**bulk theft** and **total compromise**._
