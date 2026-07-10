#!/usr/bin/env bash
# NOC OFF-SITE backup push. Mirrors the local backups (/root/backups/{db,uploads,config},
# produced nightly by ops/backup.sh) to YOUR remote backup server over SSH + rsync, so a
# copy survives loss of the VPS. Target details come from ops/offsite.env (gitignored).
#
# Safe to run by hand or from cron. If not configured yet it logs and exits 0 (no error
# spam) — so you can schedule it first and it starts working the moment you fill offsite.env.
#
#     bash /root/noc/ops/offsite-backup.sh                 # run one push
#     bash /root/noc/ops/offsite-backup.sh --test          # connectivity check only
#     bash /root/noc/ops/offsite-backup.sh --install-cron  # schedule daily 03:30
#
# One-time setup: see ops/OFFSITE.md.
set -euo pipefail

APP_DIR="${APP_DIR:-/root/noc}"
BACKUP_ROOT="${BACKUP_ROOT:-/root/backups}"
CONF="${OFFSITE_ENV:-$APP_DIR/ops/offsite.env}"

log() { printf '%s  %s\n' "$(date '+%F %T')" "$*"; }
fail() { log "ERROR: $*"; exit 1; }

# --install-cron doesn't need config; handle it before the config gate.
if [ "${1:-}" = "--install-cron" ]; then
  HOUR="${HOUR:-3}"; MIN="${MIN:-30}"        # after the 02:30 local backup
  cron=/etc/cron.d/noc-offsite
  cat > "$cron" <<EOF
# NOC off-site backup push (managed by ops/offsite-backup.sh --install-cron)
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
$MIN $HOUR * * * root /usr/bin/env bash $APP_DIR/ops/offsite-backup.sh >> $BACKUP_ROOT/offsite.log 2>&1
EOF
  chmod 644 "$cron"
  systemctl reload crond 2>/dev/null || systemctl restart crond 2>/dev/null || true
  log "installed $cron (daily $(printf '%02d:%02d' "$HOUR" "$MIN")); log -> $BACKUP_ROOT/offsite.log"
  cat "$cron"; exit 0
fi

# --- config -----------------------------------------------------------------
if [ ! -f "$CONF" ]; then
  log "off-site not configured ($CONF missing) — skipping. See ops/OFFSITE.md."
  exit 0
fi
# shellcheck disable=SC1090
. "$CONF"

OFFSITE_PORT="${OFFSITE_PORT:-22}"
OFFSITE_SSH_KEY="${OFFSITE_SSH_KEY:-/root/.ssh/noc_backup}"
OFFSITE_DELETE="${OFFSITE_DELETE:-1}"        # 1 = mirror local rotation; 0 = accumulate on remote

# Not filled in yet (blank or the example placeholder) → skip quietly so a pre-installed
# cron doesn't error every night before you've entered your server details.
case "${OFFSITE_HOST:-}" in
  ""|"backup.example.com") log "off-site not configured (set OFFSITE_HOST in $CONF) — skipping."; exit 0 ;;
esac
[ -n "${OFFSITE_USER:-}" ] || fail "OFFSITE_USER not set in $CONF"
[ -n "${OFFSITE_PATH:-}" ] || fail "OFFSITE_PATH not set in $CONF"
[ -f "$OFFSITE_SSH_KEY" ] || fail "SSH key $OFFSITE_SSH_KEY not found"

SSH="ssh -i $OFFSITE_SSH_KEY -p $OFFSITE_PORT -o BatchMode=yes -o ConnectTimeout=20 -o StrictHostKeyChecking=accept-new"
remote="$OFFSITE_USER@$OFFSITE_HOST"

# --- test mode --------------------------------------------------------------
if [ "${1:-}" = "--test" ]; then
  log "testing SSH to $remote (port $OFFSITE_PORT, key $OFFSITE_SSH_KEY) ..."
  $SSH "$remote" "echo connected as \$(whoami)@\$(hostname); mkdir -p '$OFFSITE_PATH' && echo 'remote path OK: $OFFSITE_PATH'" \
    || fail "connectivity FAILED — check host/port/user, and that noc_backup.pub is in the remote user's authorized_keys"
  log "test OK"; exit 0
fi

# --- the push ---------------------------------------------------------------
$SSH "$remote" "mkdir -p '$OFFSITE_PATH'" || fail "cannot reach $remote (run --test to diagnose)"

del=""; [ "$OFFSITE_DELETE" = "1" ] && del="--delete"
srcs=()
for d in db uploads config; do [ -d "$BACKUP_ROOT/$d" ] && srcs+=("$BACKUP_ROOT/$d"); done
[ "${#srcs[@]}" -gt 0 ] || fail "no local backups under $BACKUP_ROOT (run ops/backup.sh first)"

log "pushing ${srcs[*]} -> $remote:$OFFSITE_PATH/ (mirror-delete=$OFFSITE_DELETE)"
# shellcheck disable=SC2086
if rsync -a --partial $del --stats -e "$SSH" "${srcs[@]}" "$remote:$OFFSITE_PATH/" | tail -18; then
  log "off-site push complete"
else
  fail "rsync failed"
fi
