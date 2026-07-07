# ops/ — server operations toolkit

Scripts + runbooks for hardening and backing up the production VPS
(`root@77.42.66.76`, AlmaLinux 9 + CWP). Everything here runs **on the server**;
pull the repo there first (`cd /root/noc && git pull`).

| File | What it does | How to run |
|------|--------------|-----------|
| `audit.sh` | Read-only snapshot of firewall, sshd, open ports, brute-force load, backups. Changes nothing. | `bash ops/audit.sh` |
| `backup.sh` | Dumps the DB + archives uploads + snapshots `.env`, with rotation. | `bash ops/backup.sh` |
| `install-backups.sh` | Creates `/root/backups`, installs the daily cron, runs one backup to verify. | `bash ops/install-backups.sh` |
| `backup.env.example` | Optional credential/retention overrides for `backup.sh`. | copy to `ops/backup.env` only if needed |
| `HARDENING.md` | Gated runbook: key-only SSH + new port, auto-ban, auto-updates. | follow step by step |
| `RESTORE.md` | How to restore the DB / uploads / env, plus a non-destructive test restore. | reference |
| `CLOUDFLARE.md` | Cutover runbook: owner's zone/NS steps + server real-IP/CSF config + dashboard checklist. | follow step by step |
| `cloudflare-realip.sh` | (Re)generate Nginx `set_real_ip_from` + CSF ignore from Cloudflare's ranges. | `bash ops/cloudflare-realip.sh` (after cutover) |

## Recommended order

1. **`git pull`** on the server.
2. **`bash ops/audit.sh`** — paste the output back so the firewall/SSH steps get
   tailored to what's actually installed.
3. **Backups first** (zero lock-out risk): `bash ops/install-backups.sh`, then
   confirm files appear under `/root/backups`. Do one **test restore** from
   `RESTORE.md` so you trust them.
4. **Hardening**: follow `HARDENING.md` — but only with a second SSH session held
   open and the CWP panel reachable, exactly as that doc's "one rule" says.

## Notes

- `*.sh` files are forced to LF endings via the repo `.gitattributes` so they run
  on Linux even though the repo is edited on Windows.
- `ops/backup.env` is gitignored — it may hold DB credentials and must never be
  committed. Backups themselves live under `/root/backups`, outside the repo.
