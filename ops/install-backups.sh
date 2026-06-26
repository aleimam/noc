#!/usr/bin/env bash
# One-time setup for NOC backups: create the backup tree, install a daily cron
# job, and run one backup NOW to prove it works end-to-end. Run as root.
#
#     bash /root/noc/ops/install-backups.sh
#
# Override the run time with HOUR=3 MIN=15 bash ops/install-backups.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/root/noc}"
BACKUP_ROOT="${BACKUP_ROOT:-/root/backups}"
HOUR="${HOUR:-2}"; MIN="${MIN:-30}"        # daily run time, server local time

mkdir -p "$BACKUP_ROOT"/{db,uploads,config}
chmod 700 "$BACKUP_ROOT" "$BACKUP_ROOT"/db "$BACKUP_ROOT"/uploads "$BACKUP_ROOT"/config

cron=/etc/cron.d/noc-backup
cat > "$cron" <<EOF
# NOC nightly backup (managed by ops/install-backups.sh)
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
$MIN $HOUR * * * root /usr/bin/env bash $APP_DIR/ops/backup.sh >> $BACKUP_ROOT/backup.log 2>&1
EOF
chmod 644 "$cron"
echo "installed $cron:"; cat "$cron"

# crond auto-reads /etc/cron.d; nudge it so the schedule is picked up immediately.
systemctl reload crond 2>/dev/null || systemctl restart crond 2>/dev/null || true

echo
echo "=== running one backup now to verify ==="
bash "$APP_DIR/ops/backup.sh" | tee -a "$BACKUP_ROOT/backup.log"

echo
echo "=== current backups ==="
ls -lh "$BACKUP_ROOT"/db "$BACKUP_ROOT"/uploads "$BACKUP_ROOT"/config 2>/dev/null || true
echo
echo "Done. Backups run daily at $(printf '%02d:%02d' "$HOUR" "$MIN"); log at $BACKUP_ROOT/backup.log"
