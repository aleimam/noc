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
default **MEDIUM**) governs how much data is public and how hard we throttle. It is read via
`getSecurityLevel()` and changed from **Admin → System → Security** with no redeploy. Raise
it instantly during an incident.

| Capability | LIGHT | **MEDIUM** (default) | HIGH |
|---|---|---|---|
| Rationing **search** (name → few matches) | public | public | public |
| Full **sheet detail** page | public | **login (phone-OTP)** | login |
| High-res **source scans** | public + watermark | **login + watermark** | login + watermark |
| District / neighborhood **maps** | public + watermark | **login + watermark** | login + watermark |
| Marketplace **listing** browse + detail | public | public | full detail needs login |
| Max results per request | 50 | 50 | 25 |
| Per-IP rate limit (data endpoints, req/min) | 120 | 60 | 30 |
| Per-account daily view quota | — | — | enforced |

**Always on, every level:**
- No public **bulk or export** endpoint — exports are staff-only and permission-gated.
- Public media is **watermarked**; originals never public.
- Rate limiting and pagination caps are active (thresholds tighten by level).
- Raising the level takes effect immediately for new requests.

---

## 4. Controls

### 4.1 Authentication & authorization
- Every server action / route handler that **writes**, or reads **non-public** data, calls
  `requirePermission(section, action)` (staff) or verifies `auth()` **plus row ownership**
  (customer). Client-supplied role/id is never trusted.
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
- Both apps send: `Content-Security-Policy`, `X-Frame-Options: DENY` (or CSP
  `frame-ancestors 'none'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy:
  strict-origin-when-cross-origin`, `Strict-Transport-Security`, `Permissions-Policy`.

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

**Apache/Nginx (CWP)**
- `/uploads/*`: hotlink protection (serve only when Referer is our domains), per-IP rate
  limit, `Options -Indexes`.
- Force HTTPS + **HSTS**; TLS 1.2+ only; never expose the Next.js port directly.

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
| F1 | High | No rate limiting (login / OTP / search / upload / submissions) | open |
| F2 | High | Listing `description` rendered as raw HTML → stored XSS | open |
| F3 | Med | No security headers / CSP on either app | open |
| F4 | Med | `/uploads` lacks hotlink protection / throttle | open |
| F5 | Med | Heavy uncapped public queries (name pool 8000, browse 3000) | open |
| F6 | Med | Full sheet / scans / maps not gated at MEDIUM posture yet | open |
| F7 | Low | `AUTH_SECRET` dev fallback must be impossible in prod | open |
| F8 | Low | OTP throttled per-phone only, not per-IP | open |

---

_Pragmatic by design: individual items may be copied; effort concentrates on preventing
**bulk theft** and **total compromise**._
