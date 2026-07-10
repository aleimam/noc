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

### B3. (Recommended, after a soak period) Lock 80/443 to Cloudflare only

Once everything is proven through Cloudflare, block direct-to-IP access so scrapers
can't bypass the WAF by hitting `77.42.66.76` directly:
- Keep `80,443` in CSF `TCP_IN`, but add an `csf.allow`-style restriction, or use
  Nginx: a `default_server` catch-all on :80/:443 that returns 444 already exists via
  CWP's own vhosts — verify with `curl -k https://77.42.66.76/` (should NOT serve our
  sites' content when SNI/Host is wrong).
- Don't do this on day one — it complicates debugging the cutover.

### App note (no change needed)

Next.js sees `X-Forwarded-For` from our own Nginx; after B1, `$remote_addr` IS the
real visitor IP, so the existing `proxy_set_header X-Real-IP/X-Forwarded-For` lines
feed the app real IPs automatically. The app's rate-limiter keys keep working.

---

## Part C — Cloudflare dashboard checklist (each zone)

**Current state (2026-07-10):** zones are Active on Cloudflare (Part A done) but every
A record is **DNS-only (grey)** — so Cloudflare is only doing authoritative DNS today,
zero proxy/WAF/CDN. Part B (server real-IP + CSF trust) is **done and verified live**.
This is the "flip it on" run.

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
10. **After the flip — renewal sanity:** cert renews via **HTTP-01** (`certbot`,
    authenticator=nginx). It keeps working behind the proxy, but run one dry run to be
    sure: `certbot renew --dry-run` on the VPS. If it ever fails, switch to a Cloudflare
    **Origin Certificate** (15-yr, CF→origin only) — also removes the www-SAN gap.

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
