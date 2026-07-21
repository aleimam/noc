# Restore runbook

There are **two** backup layers, with **different archive formats**. Pick the one you have:

| Layer | Where | Format | Section |
|---|---|---|---|
| **Local nightly** (on-box) | `/root/backups` on the server | three SEPARATE files (`.sql.gz`, uploads `.tar.gz`, `env` copy) | the rest of this file |
| **Tiered off-site** (survives losing the VPS) | Hetzner Storage Box over SFTP | ONE self-contained `.tar.gz` bundle | **[Off-site tiered archive](#off-site-tiered-archive)** ← start here after a server loss |

⚠️ They are NOT interchangeable. An off-site `noc-backup-full-….tar.gz` is a *bundle*, not the
old uploads tarball — `zcat`-ing it or treating it as a SQL dump will not work.

Local nightly backups live under `/root/backups`:
- `db/noc-db-YYYYMMDD-HHMMSS.sql.gz` — gzipped MariaDB dump
- `uploads/uploads-YYYYMMDD-HHMMSS.tar.gz` — the `/root/noc/uploads` tree
- `config/env-YYYYMMDD-HHMMSS.bak` — a copy of `.env` (secrets)

A backup you've never restored is just a hope. Do the **test restore** below once
so you know it works.

---

## Off-site tiered archive

Use this when `/root/backups` (or the whole VPS) is gone. Connection details are in the admin
UI at `/admin/settings/backups`; the password is stored encrypted, so if you don't have it,
get it from the Hetzner Storage Box account itself.

**1 — Fetch.** The sub-account sees its base as `/home`, and each level keeps its own folder
(`/home/hourly`, `/home/daily`, `/home/weekly`, `/home/manual`). **Port 23, not 22** — 22
answers but is chrooted and silently writes to the wrong path.

```bash
sftp -P 23 u635384-sub6@<storagebox-host>
sftp> ls -lt /home/daily          # newest full bundles
sftp> get /home/daily/noc-backup-full-YYYYMMDD-HHMMSS.tar.gz
sftp> bye
```

**2 — Inspect BEFORE extracting.** Every archive carries a manifest stating what it actually
holds — trust that, not the filename:

```bash
A=./noc-backup-full-YYYYMMDD-HHMMSS.tar.gz
tar -tzf "$A"                              # expect: database.sql, manifest.json, [env.txt], [uploads/]
tar -xzOf "$A" manifest.json               # {"app":"noc","kind":"full","createdAt":…,"contents":"db,uploads,env"}
```

`contents` is authoritative. A `db`-only value means this bundle has **no** uploads and **no**
`.env`, whatever the file is called.

**3 — Extract to a scratch directory** (never straight over a live tree):

```bash
mkdir -p /root/restore && tar -xzf "$A" -C /root/restore
ls -la /root/restore
head -20 /root/restore/database.sql
```

**4 — Test-import the database into a scratch DB** (non-destructive):

```bash
mysql -e "CREATE DATABASE noc_restore_test"
mysql noc_restore_test < /root/restore/database.sql
mysql noc_restore_test -e "SHOW TABLES; SELECT COUNT(*) FROM Listing; SELECT COUNT(*) FROM RationingSheet;"
# when satisfied:
mysql -e "DROP DATABASE noc_restore_test"
```

**5 — Restore for real** (destructive — take a fresh dump of whatever still exists first):

```bash
pm2 stop all
mysqldump noc | gzip > /root/pre-restore-$(date +%F-%H%M).sql.gz   # safety net
mysql noc < /root/restore/database.sql

# uploads (only if the manifest listed them)
rsync -a --delete /root/restore/uploads/ /root/noc/uploads/

# .env (only if the manifest listed it) — restores DB creds, AUTH_SECRET, API keys
install -m 600 /root/restore/env.txt /root/noc/.env

pm2 restart ecosystem.config.js --update-env     # --update-env: pm2 does NOT re-read env on reload
```

**6 — Clean up.** The scratch copy holds the database and your secrets in plaintext:

```bash
shred -u /root/restore/env.txt 2>/dev/null; rm -rf /root/restore "$A"
```

> If `AUTH_SECRET` changed relative to what's in the DB, the stored SFTP password can no longer
> be decrypted — re-enter it in the Backups admin after restoring.

---

## Pick a backup

```bash
ls -lt /root/backups/db | head
ls -lt /root/backups/uploads | head
DB=/root/backups/db/noc-db-XXXXXXXX-XXXXXX.sql.gz        # set these to the files
UP=/root/backups/uploads/uploads-XXXXXXXX-XXXXXX.tar.gz   # you want to restore
```

The dump is plain SQL once unzipped — sanity-check it:
```bash
zcat "$DB" | head -20
zcat "$DB" | wc -l
```

---

## Test restore (non-destructive — do this first)

Restore the dump into a throwaway database and count rows. This proves the backup
is good without touching production.

```bash
mysql -e "CREATE DATABASE IF NOT EXISTS noc_restore_test"
zcat "$DB" | mysql noc_restore_test
mysql noc_restore_test -e "SELECT
  (SELECT COUNT(*) FROM User)    AS users,
  (SELECT COUNT(*) FROM Listing) AS listings,
  (SELECT COUNT(*) FROM District) AS districts;"
# clean up:
mysql -e "DROP DATABASE noc_restore_test"
```
(If the system `root` MySQL login needs a password, add
`--defaults-extra-file=/root/.my.cnf` or `-u noc_user -p` to each `mysql` call.)

---

## Real restore — database (DESTRUCTIVE: overwrites current data)

Only in an actual recovery. Take a fresh backup first if the DB is still alive
(`bash /root/noc/ops/backup.sh`).

```bash
pm2 stop all                      # stop the apps so nothing writes mid-restore
zcat "$DB" | mysql noc            # import over the live DB
pm2 start all
```

## Real restore — uploads

```bash
pm2 stop all
# the archive contains an `uploads/` folder; extract it back into /root/noc
tar -xzf "$UP" -C /root/noc
pm2 start all
```

## Restore .env (only if lost)

```bash
ls -lt /root/backups/config | head
cp /root/backups/config/env-XXXXXXXX-XXXXXX.bak /root/noc/.env
chmod 600 /root/noc/.env
```

---

## Full server rebuild (worst case)

1. Re-provision AlmaLinux + CWP, Node 20, PM2, MariaDB (see `DEPLOY.md`).
2. `git clone https://github.com/aleimam/noc.git /root/noc`
3. Restore `.env` (above), then `npm install`.
4. `mysql -e "CREATE DATABASE noc"` and restore the DB dump into it.
5. Restore the uploads archive.
6. `npm run db:generate && npm run build && pm2 start ecosystem.config.js && pm2 save`
7. Re-point Nginx + TLS per the `production-deployment` notes.
