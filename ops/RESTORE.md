# Restore runbook

Backups live under `/root/backups` on the server:
- `db/noc-db-YYYYMMDD-HHMMSS.sql.gz` — gzipped MariaDB dump
- `uploads/uploads-YYYYMMDD-HHMMSS.tar.gz` — the `/root/noc/uploads` tree
- `config/env-YYYYMMDD-HHMMSS.bak` — a copy of `.env` (secrets)

A backup you've never restored is just a hope. Do the **test restore** below once
so you know it works.

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
