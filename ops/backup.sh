#!/usr/bin/env bash
# NOC backup - dumps the MariaDB database, archives the uploads directory, and
# snapshots .env, into timestamped files under /root/backups with age-based
# rotation. Safe to run by hand or from cron. Run as root on the server.
#
#     bash /root/noc/ops/backup.sh
#
# Defaults can be overridden by exporting vars, or by creating ops/backup.env
# (gitignored) with lines like  RETAIN_DAYS=30  or explicit DB_USER/DB_PASS/...
set -euo pipefail

APP_DIR="${APP_DIR:-/root/noc}"
BACKUP_ROOT="${BACKUP_ROOT:-/root/backups}"
RETAIN_DAYS="${RETAIN_DAYS:-14}"            # prune backups older than N days
UPLOADS_DIR="${UPLOADS_DIR:-$APP_DIR/uploads}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env}"

# Optional overrides (DB_USER, DB_PASS, DB_HOST, DB_PORT, DB_NAME, RETAIN_DAYS...)
[ -f "$APP_DIR/ops/backup.env" ] && . "$APP_DIR/ops/backup.env"

ts="$(date +%Y%m%d-%H%M%S)"
log() { printf '%s  %s\n' "$(date '+%F %T')" "$*"; }
fail() { log "ERROR: $*"; exit 1; }

DB_DIR="$BACKUP_ROOT/db"
UP_DIR="$BACKUP_ROOT/uploads"
CFG_DIR="$BACKUP_ROOT/config"
mkdir -p "$DB_DIR" "$UP_DIR" "$CFG_DIR"
chmod 700 "$BACKUP_ROOT" "$DB_DIR" "$UP_DIR" "$CFG_DIR"

# --- Resolve DB credentials -------------------------------------------------
# Prefer explicit DB_* (from backup.env); else parse DATABASE_URL from .env.
# Percent-decode (e.g. %40 -> @) via octal so it works on any POSIX printf and
# never mangles a literal '+' (in a URL's user:pass@ part '+' is not a space).
urldecode() {
  local s="$1"
  local out="" i=0 n=${#s} c
  while [ "$i" -lt "$n" ]; do
    c="${s:i:1}"
    if [ "$c" = "%" ]; then
      printf -v c "\\$(printf '%03o' "0x${s:i+1:2}")"
      i=$((i+3))
    else
      i=$((i+1))
    fi
    out+="$c"
  done
  printf '%s' "$out"
}

if [ -z "${DB_NAME:-}" ]; then
  [ -f "$ENV_FILE" ] || fail "no .env at $ENV_FILE and no DB_* overrides set"
  DB_URL="$(grep -E '^[[:space:]]*DATABASE_URL[[:space:]]*=' "$ENV_FILE" | tail -1 \
            | sed -E 's/^[^=]*=//; s/^["'\'']//; s/["'\'']$//' || true)"
  [ -n "$DB_URL" ] || fail "DATABASE_URL not found in $ENV_FILE"
  rest="${DB_URL#*://}"                     # user:pass@host:port/db?params
  creds="${rest%%@*}"
  hostpart="${rest#*@}"
  DB_USER="$(urldecode "${creds%%:*}")"
  DB_PASS="$(urldecode "${creds#*:}")"
  hp="${hostpart%%/*}"                      # host:port
  DB_HOST="${hp%%:*}"
  if [ "$hp" = "$DB_HOST" ]; then DB_PORT=3306; else DB_PORT="${hp#*:}"; fi
  dbn="${hostpart#*/}"
  DB_NAME="${dbn%%\?*}"
fi
: "${DB_HOST:=127.0.0.1}" "${DB_PORT:=3306}"

# MariaDB ships mariadb-dump; mysqldump is usually a symlink to it.
DUMP="$(command -v mariadb-dump || command -v mysqldump || true)"
[ -n "$DUMP" ] || fail "mariadb-dump/mysqldump not found"

# Transient option file so the password never shows up in `ps` / process list.
CNF="$(mktemp)"; chmod 600 "$CNF"
trap 'rm -f "$CNF"' EXIT
cat > "$CNF" <<EOF
[client]
host=$DB_HOST
port=$DB_PORT
user=$DB_USER
password=$DB_PASS
EOF

# --- 1) Database ------------------------------------------------------------
db_out="$DB_DIR/noc-db-$ts.sql.gz"
log "dumping database '$DB_NAME' -> $db_out"
# --single-transaction: consistent InnoDB snapshot without locking / extra privs.
# --no-tablespaces: avoid the global PROCESS privilege a plain dump needs on
#   MySQL 8 / MariaDB (a non-root app user like noc_user usually lacks it).
# Triggers are included by default; routines/events are omitted (NOC has none
# and dumping them would need extra grants on the app user).
if "$DUMP" --defaults-extra-file="$CNF" --single-transaction --quick \
       --no-tablespaces "$DB_NAME" | gzip -c > "$db_out.partial"; then
  mv "$db_out.partial" "$db_out"
  log "database OK ($(du -h "$db_out" | cut -f1))"
else
  rm -f "$db_out.partial"; fail "database dump failed (check DB creds / privileges)"
fi

# --- 2) Uploads -------------------------------------------------------------
if [ -d "$UPLOADS_DIR" ]; then
  up_out="$UP_DIR/uploads-$ts.tar.gz"
  log "archiving uploads $UPLOADS_DIR -> $up_out"
  if tar -czf "$up_out.partial" -C "$(dirname "$UPLOADS_DIR")" "$(basename "$UPLOADS_DIR")"; then
    mv "$up_out.partial" "$up_out"
    log "uploads OK ($(du -h "$up_out" | cut -f1))"
  else
    rm -f "$up_out.partial"; fail "uploads archive failed"
  fi
else
  log "WARN: uploads dir $UPLOADS_DIR not found, skipping"
fi

# --- 3) .env snapshot (secrets - kept 600 inside the 700 backup tree) -------
if [ -f "$ENV_FILE" ]; then
  cfg_out="$CFG_DIR/env-$ts.bak"
  cp "$ENV_FILE" "$cfg_out"; chmod 600 "$cfg_out"
  log "env snapshot -> $cfg_out"
fi

# --- 4) Rotation ------------------------------------------------------------
log "pruning backups older than $RETAIN_DAYS days"
find "$DB_DIR"  -type f -name 'noc-db-*.sql.gz'  -mtime +"$RETAIN_DAYS" -print -delete 2>/dev/null | sed 's/^/  rm /' || true
find "$UP_DIR"  -type f -name 'uploads-*.tar.gz' -mtime +"$RETAIN_DAYS" -print -delete 2>/dev/null | sed 's/^/  rm /' || true
find "$CFG_DIR" -type f -name 'env-*.bak'        -mtime +"$RETAIN_DAYS" -print -delete 2>/dev/null | sed 's/^/  rm /' || true

log "backup complete"
