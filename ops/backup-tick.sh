#!/usr/bin/env bash
# Wrapper for ops/backup-tick.ts (the off-site backup scheduler tick).
#   bash ops/backup-tick.sh                 # run one tick
#   bash ops/backup-tick.sh --install-cron  # schedule every 10 minutes
set -euo pipefail
APP_DIR="${APP_DIR:-/root/noc}"
BACKUP_ROOT="${BACKUP_ROOT:-/root/backups}"

if [ "${1:-}" = "--install-cron" ]; then
  cron=/etc/cron.d/noc-backup-tick
  cat > "$cron" <<EOF
# NOC off-site backup tick (managed by ops/backup-tick.sh --install-cron).
# Runs every 10 min; the app decides which levels are actually due.
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
*/10 * * * * root cd $APP_DIR && npx dotenv -e .env -- tsx ops/backup-tick.ts >> $BACKUP_ROOT/backup-tick.log 2>&1
EOF
  chmod 644 "$cron"
  systemctl reload crond 2>/dev/null || systemctl restart crond 2>/dev/null || true
  echo "installed $cron (every 10 min); log -> $BACKUP_ROOT/backup-tick.log"
  cat "$cron"; exit 0
fi

cd "$APP_DIR"
exec npx dotenv -e .env -- tsx ops/backup-tick.ts
