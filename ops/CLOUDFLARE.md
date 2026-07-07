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

Order matters — TLS first:

1. **SSL/TLS → Overview → mode = Full (strict).** The origin has a valid Let's
   Encrypt cert for both domains, so strict works. (NEVER "Flexible" — redirect loops
   + plaintext origin traffic.)
2. **SSL/TLS → Edge Certificates:** enable *Always Use HTTPS* + *HTTP/3*.
   Note: our Nginx already 301s HTTP→HTTPS; enabling it at the edge too is fine.
3. **Speed → Optimization:** Brotli on (default). Skip Rocket Loader (breaks Next.js
   hydration sometimes) — leave OFF.
4. **Caching:** leave standard. Next.js sends correct cache headers for
   `/_next/static` (immutable) — no page-cache rules needed. Do NOT "Cache Everything".
5. **Security:**
   - **Bot Fight Mode: ON** (Security → Bots).
   - Security level: Medium.
   - **WAF managed rules** (free tier's Cloudflare Managed Ruleset): ON.
6. **WAF → Rate limiting rule** (1 free rule per zone) — edge backstop above the app's
   quotas. Suggested: if URI path starts with `/rationing` (newobour zone) → more than
   **60 requests / 1 minute per IP** → Block for 1 hour. On alsawarey: path `/` any,
   300 req/min per IP → Managed Challenge.
7. **Hotlink protection** (Scrape Shield): ON for both zones — stops other sites
   embedding `/uploads/*` images. (Our own two domains still work: Cloudflare allows
   same-zone referers; cross-site NO→AlSawarey image use is same files via each site's
   own proxy route, so unaffected.)
8. **Renewal caveat — Let's Encrypt:** our cert renews via **HTTP-01** (`certbot`,
   `/.well-known/acme-challenge/`). This keeps working behind the proxy (Cloudflare
   passes it through; Always-Use-HTTPS excludes ACME paths). After the cutover, do one
   dry run to be sure: `certbot renew --dry-run` on the server. If it ever fails,
   switch that cert to the DNS-01 plugin or a Cloudflare Origin Certificate.

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
