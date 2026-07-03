# Security Standard — NOC (New Obour + ALSWARY)

> Owner: platform admin. Review this on every deploy and whenever a new endpoint,
> upload surface, or public data view is added. Last reviewed: 2026-07-03.

---

## 0. Reality check (read this first)

**Publicly viewable data cannot be made impossible to copy.** If a browser renders a
rationing sheet, a map, or a listing, that content is on the visitor's machine and can be
saved, screenshotted, or scraped. Client-side tricks (disable right-click, block
dev-tools, obfuscate) are theatre — trivially bypassed, and they punish our low-tech
users. We therefore pursue two *different* goals:

- **Deterrence (anti-scraping):** make **bulk** extraction slow, costly, detectable, and
  legally watermarked — so copying "everything" is impractical, not that copying one item
  is blocked.
- **Prevention (hardening):** make sure nobody gets the **database, files, or admin** in
  one shot — that is the real catastrophe.

The single worst outcome is a **full DB dump** or **admin compromise**. Prioritise
accordingly: hardening > deterrence.

---

## 1. Data-access posture (Light / Medium / High) — admin-switchable

A single backend setting `security.level` (Setting key `security.level`, values
`LIGHT | MEDIUM | HIGH`, default **MEDIUM**) controls how much public data is exposed and
how strict throttling is. Read via `getSecurityLevel()`; changeable from
**Admin → System → Security** without a deploy.

| Capability | LIGHT | MEDIUM (default) | HIGH |
|---|---|---|---|
| Rationing **search** (name → few matches) | public | public | public |
| Full **sheet detail** page | public | **login (phone-OTP)** | login |
| High-res **source scans** | watermarked, public | **login + watermarked** | login + watermarked |
| District/neighborhood **maps** | watermarked, public | **login + watermarked** | login + watermarked |
| Marketplace **listings** browse/detail | public | public | login for full detail |
| Per-request result cap | 50 | 50 | 25 |
| Per-IP rate limit (req/min to data endpoints) | 120 | 60 | 30 |
| Per-account daily view quota | none | none | enforced |

Rules that apply at **every** level:
- No public bulk or export endpoint. Exports are staff-only + permission-gated.
- All public media is served **watermarked**; the clean original is never public.
- Rate limiting and pagination caps are always on (numbers tighten by level).

---

## 2. Application security criteria (must hold at all times)

1. **AuthN / AuthZ on every mutation and protected read.**
   - Every server action and route handler that writes, or reads non-public data, calls
     `requirePermission(section, action)` (staff) or checks `auth()` + ownership
     (customer). Never trust a role/id sent from the client.
   - Ownership (IDOR) check on every by-id customer action: the row's `userId`/`sellerId`
     must equal the session user (or the caller is STAFF).
2. **Output encoding / no stored XSS.**
   - Any HTML rendered via `dangerouslySetInnerHTML` MUST be sanitised server-side with an
     allow-list sanitiser (`sanitize-html`) before storage or render. This includes
     listing `description`, page/news/guide bodies, geo-update bodies, building-condition
     bodies. Customer-authored fields are untrusted.
3. **Input validation.** Validate type, length, and range on every server-action input;
   normalise phones; reject oversized payloads. Never build SQL by string — Prisma only.
4. **Rate limiting** (per-IP + per-identity) on: staff login, OTP request, OTP verify,
   public search, `/api/upload`, contact/lead/offer/follow submissions. Fail closed with
   HTTP 429.
5. **File uploads.** Trust bytes not the client type (magic-byte sniff — already done);
   enforce size cap (32 MB); randomised filenames; SVG disallowed; keep the **pure
   original private**, publish only the watermarked/stamped copy.
6. **Secrets.** `AUTH_SECRET` must be a strong random 32+ byte value in prod (never the
   dev fallback); never exposed via `NEXT_PUBLIC_*`; `.env` is `chmod 600`. Rotate on any
   suspected leak or staff offboarding.
7. **Sessions/cookies.** httpOnly + Secure + SameSite=Lax; short TTL; sign-out clears
   server session.
8. **Security headers** on both apps: `Content-Security-Policy`, `X-Frame-Options: DENY`
   (or CSP `frame-ancestors`), `X-Content-Type-Options: nosniff`, `Referrer-Policy:
   strict-origin-when-cross-origin`, `Strict-Transport-Security` (HSTS), and a
   `Permissions-Policy`.
9. **Dependencies.** `npm audit` before each release; patch High/Critical promptly; keep
   Next.js/Prisma/next-auth current.
10. **Logging.** Record auth failures, 429s, permission-denials, and admin-view token
    mints. Alert on spikes (possible scraping/brute force).

---

## 3. Infrastructure standard (server / proxy / DB / ops)

1. **Edge / CDN (strongly recommended): Cloudflare** in front of both domains —
   Bot Fight Mode, WAF managed rules, edge rate-limiting, and hotlink/referrer rules for
   `/uploads/*`. This is the cheapest, highest-leverage anti-scraping + DDoS control.
2. **Apache/Nginx (CWP):**
   - `/uploads/*`: enable **hotlink protection** (only serve when Referer is our domains),
     add a per-IP rate limit, disable directory listing (`Options -Indexes`).
   - Force HTTPS + **HSTS**; modern TLS only (no TLS 1.0/1.1).
   - Do not expose the Next.js port directly; proxy only.
3. **Database (MariaDB):**
   - App connects as a **least-privilege user** (DML only; no DROP/GRANT/FILE), never root.
   - Bind to `127.0.0.1`; port 3306 closed at the firewall.
   - Strong unique password; rotate periodically.
   - **Automated encrypted backups**, off-server (e.g., nightly `mysqldump` → encrypted →
     offsite/Cloudflare R2/S3). **Test a restore quarterly.** Backups are your real
     insurance against both ransomware and "someone copied everything."
4. **OS / SSH:**
   - SSH: **key-only auth**, disable password login (the server already shows 47 failed
     password attempts — close this), non-default port optional, `fail2ban` on.
   - `firewalld`/ufw: allow only 80/443/SSH.
   - Keep OS + PHP/CWP patched; unattended security updates.
5. **Secrets & files:** `.env` `chmod 600`, owned by the app user; never in git; rotate
   `AUTH_SECRET`/SMS creds on staff changes.
6. **PM2/runtime:** run apps as a non-root user; log rotation on.

---

## 4. Procedures — the checklist to follow every time

**Before every deploy**
- [ ] `npm audit` — no unresolved High/Critical.
- [ ] `npm run build` green for both apps; typecheck passes.
- [ ] Any new server action/route has `requirePermission`/`auth` + ownership check.
- [ ] Any new `dangerouslySetInnerHTML` renders **sanitised** HTML only.
- [ ] Any new upload/download surface enforces MIME + size + privacy of originals.
- [ ] Migrations reviewed; `db:release` run where schema changed.

**Monthly**
- [ ] Review auth-failure / 429 / rate-limit logs for scraping or brute-force patterns.
- [ ] Confirm backups ran and a test restore works.
- [ ] `npm outdated` — plan updates for Next/Prisma/next-auth.

**On incident (suspected scrape / breach)**
- [ ] Raise `security.level` to HIGH from the backend (immediate throttle + login-gate).
- [ ] Block offending IPs/ASNs at Cloudflare/Apache.
- [ ] Rotate `AUTH_SECRET` + SMS creds; force staff re-login.
- [ ] Review DB access logs; restore from clean backup if integrity in doubt.

**When adding a new public data view**
- [ ] Decide its gate per the posture table (§1); wire it to `getSecurityLevel()`.
- [ ] Serve only watermarked media; keep originals private.
- [ ] Add pagination caps; ensure it's covered by rate limiting.

---

## 5. Findings register

Open findings from the security review are tracked below; update status as fixed.
(See the review report; severities: Critical / High / Medium / Low.)

| # | Severity | Area | Status |
|---|---|---|---|
| F1 | High | No rate limiting (login/OTP/search/upload) | open |
| F2 | High | Listing description rendered as raw HTML (stored XSS) | open |
| F3 | Medium | No security headers / CSP | open |
| F4 | Medium | `/uploads` no hotlink protection / throttle | open |
| F5 | Medium | Heavy uncapped public queries (name pool 8000, browse 3000) | open |
| F6 | Medium | Full sheet detail / scans / maps not gated at MEDIUM posture | open |
| F7 | Low | `AUTH_SECRET` dev fallback must be impossible in prod | open |
| F8 | Low | OTP request throttled per-phone only, not per-IP | open |

---

_This standard is deliberately pragmatic: it accepts that individual items can be copied,
and concentrates effort on preventing bulk theft and total compromise._
