# Off-site backups — one-time setup

On-server backups already run nightly at **02:30** under `/root/backups` (DB + uploads +
`.env`, 14-day rotation — see `RESTORE.md`). This adds an **off-site copy** pushed to *your*
backup server at **03:30**, so a copy survives even if the whole VPS is lost.

Everything is pre-installed on the VPS. You only need to do three things — steps 1 and 2 are
yours (they involve *your* backup server); once done, the nightly push starts automatically.

## 1. Enter your backup server's details (on the VPS)
```bash
cp /root/noc/ops/offsite.env.example /root/noc/ops/offsite.env
nano /root/noc/ops/offsite.env      # set OFFSITE_HOST / OFFSITE_USER / OFFSITE_PORT / OFFSITE_PATH
```

## 2. Let the VPS log in to your backup server
The VPS already has a dedicated key. Print its **public** half:
```bash
cat /root/.ssh/noc_backup.pub
```
Then, on **your backup server**, logged in as the `OFFSITE_USER` you chose, add that one line
to its authorized keys:
```bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
echo 'ssh-ed25519 AAAA...the line you copied... noc-backup' >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```
(Only `ssh` + `rsync` are needed on the remote — no database or app access.)

## 3. Test
```bash
bash /root/noc/ops/offsite-backup.sh --test    # expect: "remote path OK" then "test OK"
bash /root/noc/ops/offsite-backup.sh           # one real push; watch the rsync summary
```
The daily 03:30 cron (`/etc/cron.d/noc-offsite`) is already installed and will simply skip
until step 1 is filled in — so after step 1+2 it just works. Log: `/root/backups/offsite.log`.

## Notes
- **Retention:** by default the remote mirrors the local 14-day window (`OFFSITE_DELETE=1`,
  bounded). Set `OFFSITE_DELETE=0` in `offsite.env` to keep every backup on the remote instead.
- **Timing:** 03:30, after the 02:30 local backup + rotation, so it ships fresh files.
- **Restore:** pull the files back from the remote, then follow `RESTORE.md` as usual.
- **Re-schedule / change time:** `HOUR=4 MIN=0 bash ops/offsite-backup.sh --install-cron`.
