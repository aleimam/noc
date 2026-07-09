#!/usr/bin/env bash
# Regenerate the Nginx real-IP config + CSF ignore entries from Cloudflare's
# published IP ranges. Run on the VPS (as root) AFTER the domains are proxied
# through Cloudflare — see ops/CLOUDFLARE.md Part B. Safe to re-run any time.
set -euo pipefail

v4="$(curl -fsS https://www.cloudflare.com/ips-v4)"
v6="$(curl -fsS https://www.cloudflare.com/ips-v6)"
[ -n "$v4" ] || { echo "ERROR: could not fetch Cloudflare ranges"; exit 1; }

# --- Nginx: restore the real visitor IP from CF-Connecting-IP ----------------
# Some CWP boxes ship a hand-made /etc/nginx/cloudflare.inc that already declares
# real_ip_header; two of those in one http{} block is a fatal "duplicate directive". This file
# is the single source of truth, so neutralize any other real_ip_header include first.
if grep -rlZE '^\s*real_ip_header' /etc/nginx/cloudflare.inc 2>/dev/null | grep -qz .; then
  cp -n /etc/nginx/cloudflare.inc /etc/nginx/cloudflare.inc.bak 2>/dev/null || true
  printf '# Superseded by /etc/nginx/conf.d/cloudflare-realip.conf (ops/cloudflare-realip.sh).\n' > /etc/nginx/cloudflare.inc
  echo "neutralized a duplicate real_ip_header in /etc/nginx/cloudflare.inc (backup: .bak)"
fi

out=/etc/nginx/conf.d/cloudflare-realip.conf
{
  echo "# Cloudflare ranges (generated $(date -u +%F) by ops/cloudflare-realip.sh - do not edit)"
  for ip in $v4 $v6; do echo "set_real_ip_from $ip;"; done
  echo 'real_ip_header CF-Connecting-IP;'
} > "$out.new"
mv "$out.new" "$out"
nginx -t && systemctl reload nginx
echo "nginx real-ip config updated: $out"

# --- CSF: never treat Cloudflare as an attacker ------------------------------
if [ -f /etc/csf/csf.ignore ]; then
  added=0
  for ip in $v4 $v6; do
    if ! grep -qF "$ip" /etc/csf/csf.ignore; then
      echo "$ip # Cloudflare" >> /etc/csf/csf.ignore
      added=$((added + 1))
    fi
  done
  if [ "$added" -gt 0 ]; then csf -r >/dev/null; fi
  echo "csf.ignore: $added new Cloudflare ranges added"
else
  echo "WARN: /etc/csf/csf.ignore not found - skipped CSF step"
fi

echo "Done. Verify with: tail -5 /var/log/nginx/access.log (should show real visitor IPs)"
