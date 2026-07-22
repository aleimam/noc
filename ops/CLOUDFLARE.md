# Cloudflare runbook (newobour.com + alsawarey.com)

Puts Cloudflare's proxy/CDN/WAF in front of both sites — the primary anti-scrape /
anti-DDoS layer (the app's per-visitor quotas stay as the inner backstop).

Split of work:
- **Owner does** (needs the Cloudflare account + registrar access): Part A.
- **Server side** (Claude can drive over SSH once Part A is done): Part B.
- **Cloudflare dashboard settings** (owner, ~10 minutes, with this checklist): Part C.

---

## Part A — Owner: create the zones and switch nameservers

1. Create a (free-plan) Cloudflare account → **Add site** → `newobour.com`.
   Repeat for `alsawarey.com`. Free plan is fine for both.
2. Cloudflare scans DNS. Verify each zone has these records (add if missing) and set
   them to **Proxied** (orange cloud):
   - `newobour.com` → **A → 77.42.66.76** (Proxied)
   - `www.newobour.com` → CNAME → `newobour.com` (Proxied)
   - `alsawarey.com` → **A → 77.42.66.76** (Proxied)
   - `www.alsawarey.com` → CNAME → `alsawarey.com` (Proxied)
   - **Mail-related records must stay DNS-only (grey cloud):** `mail.*` A records, MX
     targets, and any `webmail`/`ftp`/`cwp` records. Proxying mail breaks it.
3. At the **registrar** (where each domain was bought): replace the nameservers with
   the two Cloudflare gives you. Propagation: minutes to a few hours.
4. Tell Claude / proceed to Part B once the Cloudflare dashboard shows both zones **Active**.

⚠️ Do NOT enable "Always Use HTTPS" etc. yet — follow Part C order, TLS mode first.

---

## Part B — Server: restore real visitor IPs + firewall (run on the VPS)

Behind Cloudflare every connection comes from Cloudflare's IPs. Without this, logs,
rate-limiting, and CSF/LFD banning would see Cloudflare instead of the visitor —
LFD could even ban Cloudflare and take the sites down.

### B1. Nginx: trust Cloudflare's ranges and use the real IP

```bash
# generate the trusted-proxy list from Cloudflare's published ranges
{
  echo "# Cloudflare origin-pull ranges (regenerate: bash /root/noc/ops/cloudflare-realip.sh)"
  for ip in $(curl -fsS https://www.cloudflare.com/ips-v4) $(curl -fsS https://www.cloudflare.com/ips-v6); do
    echo "set_real_ip_from $ip;"
  done
  echo 'real_ip_header CF-Connecting-IP;'
} > /etc/nginx/conf.d/cloudflare-realip.conf
nginx -t && systemctl reload nginx
```

(That snippet is packaged as `ops/cloudflare-realip.sh`; re-run it a few times a year —
Cloudflare's ranges change rarely. Optionally cron it monthly.)

### B2. CSF: never ban Cloudflare's ranges

```bash
for ip in $(curl -fsS https://www.cloudflare.com/ips-v4) $(curl -fsS https://www.cloudflare.com/ips-v6); do
  grep -q "^$ip" /etc/csf/csf.ignore || echo "$ip # Cloudflare" >> /etc/csf/csf.ignore
done
csf -r
```

### B3. Lock the origin to Cloudflare — ⚠️ BUILT, TRIED, ROLLED BACK. CURRENTLY **OFF**.

Blocks direct-to-IP access so scrapers can't bypass the WAF / Bot Fight Mode / rate limits by
hitting `77.42.66.76`. Implemented as **`ops/cloudflare-lockdown.sh {on|off|status}`** — the
script is correct and ready; only the TIMING was wrong.

**What happened (2026-07-22).** Enabled ~2h after the proxy flip. The owner's own browser still
had the pre-flip A record cached, so it connected straight to the origin and got a hard nginx
**403 on alsawarey.com/listings**. Turned off immediately; both sites verified back.

**When it is safe:** once DNS propagation has fully drained — **~24–48h past the record TTL**.
Before enabling, confirm from a NORMAL browser on a normal connection that both names resolve to
Cloudflare. **Never validate with `curl --resolve <cf-edge>`** — that forces traffic through
Cloudflare and hides this failure completely. It tests the path you assume, not the path a
visitor takes.

**Three traps, all paid for in production:**
1. `allow`/`deny` matches `$remote_addr` **after** the `real_ip` module rewrites it (we set
   `real_ip_header CF-Connecting-IP` in B1), so by then it holds the VISITOR's IP, never
   Cloudflare's — the rule rejected everyone (~40s outage). Must key on **`$realip_remote_addr`**.
2. A self-check that curls the site through Cloudflare **from this box** is a guaranteed false
   negative: Cloudflare blocks this datacenter IP, so it returns 403 whether B3 is on or off. It
   auto-reverted a perfectly good config once.
3. **B3 changes the rollback procedure.** Grey-clouding alone would then send visitors to an
   origin that answers 403. Rollback is **two steps, in order: `cloudflare-lockdown.sh off`
   FIRST, then grey-cloud.**

Scope (deliberate — a blanket rule causes outages): only the two **apex** `:443` vhosts. `www.*`
is still DNS-only/grey, so restricting it would 403 real visitors; it only `return 301`s to the
apex anyway. `:80` stays open for `/.well-known/acme-challenge/`. CWP's `webmail.noc` /
`mail.noc` / `cpanel.noc` / bare-IP vhosts are untouched — restricting those locks the owner out
of webmail and the control panel.

### App note (no change needed)

Next.js sees `X-Forwarded-For` from our own Nginx; after B1, `$remote_addr` IS the
real visitor IP, so the existing `proxy_set_header X-Real-IP/X-Forwarded-For` lines
feed the app real IPs automatically. The app's rate-limiter keys keep working.

---

## Part C — Cloudflare dashboard checklist (each zone)

> ## ✅ DONE — both zones proxied and verified 2026-07-22
> Apex records for **newobour.com** and **alsawarey.com** are orange-clouded, SSL/TLS is
> **Full (strict)**, and the settings pass (steps 4–9) is applied on both. Verified end to end:
> - `Server: cloudflare` + `CF-RAY` on both; `alt-svc: h3` (HTTP/3 on); HTTP→HTTPS 301 at the edge.
> - **Real visitor IP restored** — probed through the edge, nginx saw the true client IP, not a
>   Cloudflare range. (Access logging is `off` globally on this box, so this was proved with a
>   temporary `location = /__cfprobe` returning `$remote_addr`, then removed.)
> - **Cert renewal survives the proxy** — `/.well-known/acme-challenge/` served through Cloudflare
>   on both zones.
> - **Rocket Loader off** (0 refs) and **hydration works** — theme toggle flips live in Chrome.
> - **Hotlink protection behaves**: no-referer → 200 (social/WhatsApp previews safe), same-site →
>   200, foreign referer → 403. Cross-brand 403 is harmless: each app serves `/uploads` same-origin.
> - `cf-cache-status: DYNAMIC` on both homepages — logged-in/admin HTML is NOT being cached.
>
> Rollback remains one click: set the record back to **grey (DNS-only)**.
> Remaining optional hardening: **B3** (lock :80/:443 to Cloudflare ranges only) after a soak.

**State before the flip (2026-07-10 → 2026-07-22):** zones were Active on Cloudflare (Part A done)
but every A record was **DNS-only (grey)** — Cloudflare did authoritative DNS only, zero
proxy/WAF/CDN. Part B (server real-IP + CSF trust) was done and verified live.

**Pre-flight — verified on the origin `77.42.66.76:443` (2026-07-10):**
- The Let's Encrypt cert is a **SAN cert for all four names** — `newobour.com`,
  `www.newobour.com`, `alsawarey.com`, `www.alsawarey.com` → **Full (strict) validates
  for every one** (incl. www). The origin also 301s `www.*` → apex with that cert.
  Renewal was repaired: `authenticator = webroot` (the certbot *nginx* authenticator
  is broken on this CWP box) + `renew_hook = systemctl reload nginx`.
- Real-IP restore (`CF-Connecting-IP`, 22 ranges) + CSF trust (22 ranges) are live;
  `nginx -t` passes. LFD will not ban Cloudflare after the flip.

Do it **one zone at a time**, in **this order** (TLS mode BEFORE the DNS flip):

1. **SSL/TLS → Overview → mode = Full (strict)** — set this FIRST, while records are
   still grey. It's harmless now and only takes effect once traffic is proxied.
   (NEVER "Flexible" — redirect loops + plaintext origin traffic.)
2. **DNS → flip the APEX record to Proxied (orange):** `newobour.com  A  77.42.66.76`
   → click the grey cloud so it turns orange. Wait ~30s, then verify from any shell:
   `curl -sI https://newobour.com | grep -i cf-ray` → a `cf-ray:` header appears **and**
   the site loads + sign-in/OTP still work. Only if good, repeat the whole run for the
   **alsawarey** zone (`alsawarey.com A 77.42.66.76`).
3. **www — now safe to orange-proxy** (the origin cert covers `www` and the origin 301s
   `www.*` → apex). Flip the `www` CNAMEs to Proxied too if you want; they'll redirect to
   the apex. (Or leave them grey / add an edge Redirect Rule — all three work now.)
4. **SSL/TLS → Edge Certificates:** *Always Use HTTPS* ON, *HTTP/3* ON. (Our Nginx
   already 301s HTTP→HTTPS; enabling it at the edge too is fine. Always-Use-HTTPS keeps
   the built-in `/.well-known/acme-challenge/` exception, so cert renewal still works.)
5. **Speed → Optimization:** Brotli on (default). **Rocket Loader OFF** (breaks Next.js
   hydration). No "Auto Minify" needed — Next already minifies.
6. **Caching:** leave standard. Next.js sends correct `/_next/static` immutable headers —
   no page rules needed. **Do NOT "Cache Everything"** (would cache logged-in/admin HTML).
7. **Security:** Bot Fight Mode **ON** (Security → Bots); Security level **Medium**;
   **WAF → Managed rules → Cloudflare Managed Ruleset ON** (free tier).
8. **Security → WAF → Rate limiting rule** (1 free rule per zone) — edge backstop above
   the app's own quotas. newobour: path starts with `/rationing` → >**60 req / 1 min per
   IP** → Block 1h. alsawarey: path `/` → >**300 req / 1 min per IP** → Managed Challenge.
9. **Scrape Shield → Hotlink protection ON** (both zones) — stops other sites embedding
   `/uploads/*`. Same-zone referers still work; the NO↔AS image sharing goes through each
   app's own proxy route (same-origin), so it's unaffected.
10. **After the flip — renewal sanity:** cert renews via **HTTP-01 with the `webroot`
    authenticator** (`/usr/local/apache/autossl_tmp`) — **NOT** the certbot *nginx*
    authenticator, which is broken on this CWP box (see CLAUDE.md). The :80 vhosts serve
    `/.well-known/acme-challenge/` before redirecting, and Cloudflare's *Always Use HTTPS*
    keeps its built-in ACME exception, so renewal survives the proxy. Confirm with one
    `certbot renew --dry-run` on the VPS after the flip. If it ever fails, switch to a
    Cloudflare **Origin Certificate** (15-yr, CF→origin only).

---

## Verification after cutover

```bash
# From the server — confirm real IPs are being restored (should show YOUR home IP,
# not a Cloudflare 104.x/172.x address), after you visit the site once:
tail -5 /var/log/nginx/access.log

# Both sites through the edge (look for the cf-ray / server: cloudflare headers):
curl -sI https://newobour.com | grep -iE 'cf-ray|server'
curl -sI https://alsawarey.com | grep -iE 'cf-ray|server'

# TLS still valid end-to-end, sign-in + OTP + admin all work, uploads render.
```

Rollback: set the DNS records to **DNS-only (grey cloud)** in Cloudflare — traffic
goes direct to the origin again within minutes. (Keep the Cloudflare nameservers;
grey-clouding is the rollback, no registrar change needed.)
