# Server hardening runbook (newobour.com / alsawarey.com)

AlmaLinux 9 + CWP, `root@77.42.66.76`. Goal: stop the SSH root brute-forcing and
shrink the attack surface, **without ever locking ourselves out.**

Chosen path: **key-only SSH + non-standard port**, plus auto-banning of attackers
and automatic security updates.

> ## The one rule that prevents lockouts
> **Keep a second, already-connected SSH session open the entire time, and never
> close it until a BRAND-NEW session has logged in successfully with the new
> settings.** A live session is unaffected by sshd config changes; if a change is
> bad, you fix it from that session. Your **CWP panel** (`https://77.42.66.76:2087`,
> it has a built-in Terminal/File Manager) is the backup-of-the-backup — it does
> not depend on SSH at all.

Every phase ends with a **VERIFY GATE**. Do not proceed past a gate until it passes.

---

## Phase 0 — Pre-flight

1. Open **two** SSH sessions to the server. Call them **A** (working) and
   **B** (safety — do not touch it, do not close it).
2. Confirm you can log into the **CWP panel** in a browser (separate fallback).
3. Back up the current SSH config (in session A):
   ```bash
   cp -a /etc/ssh/sshd_config /root/sshd_config.bak.$(date +%F)
   ```
4. Run the audit so we know the firewall + current state:
   ```bash
   bash /root/noc/ops/audit.sh
   ```
   The audit's **Firewall** section decides which variant you use below
   (**CSF** is the default on CWP; **firewalld** is the fallback).

---

## Phase 1 — Install your SSH key (passwords still ON)

Do this while password login still works, so a mistake can't lock you out.

1. **On your local PC** (the machine you SSH *from*), create a key if you don't
   have one. On Windows PowerShell or Git Bash:
   ```bash
   ssh-keygen -t ed25519 -C "noc-admin" -f "$HOME/.ssh/noc_ed25519"
   ```
   Press Enter twice for no passphrase (or set one — recommended). This creates
   `noc_ed25519` (PRIVATE — never share) and `noc_ed25519.pub` (public).

2. **Copy the public key to the server.** Easiest, while passwords still work:
   ```bash
   ssh-copy-id -i "$HOME/.ssh/noc_ed25519.pub" root@77.42.66.76
   ```
   No `ssh-copy-id` on Windows? Print the public key and paste it into the
   server's `authorized_keys` from session A instead:
   ```bash
   # local: show the public key
   cat "$HOME/.ssh/noc_ed25519.pub"
   ```
   ```bash
   # server (session A): paste the line between the quotes
   mkdir -p /root/.ssh && chmod 700 /root/.ssh
   echo "ssh-ed25519 AAAA...the whole line... noc-admin" >> /root/.ssh/authorized_keys
   chmod 600 /root/.ssh/authorized_keys
   restorecon -Rv /root/.ssh   # fix SELinux labels so the key is honored
   ```

3. **VERIFY GATE 1 — the key works.** From a NEW local terminal:
   ```bash
   ssh -i "$HOME/.ssh/noc_ed25519" root@77.42.66.76 'echo KEY_LOGIN_OK; hostname'
   ```
   You must see `KEY_LOGIN_OK` **without being asked for a password.**
   - Tip: add a host alias to `~/.ssh/config` so you don't retype `-i`:
     ```
     Host noc
       HostName 77.42.66.76
       User root
       IdentityFile ~/.ssh/noc_ed25519
       # Port 52200   # uncomment after Phase 2
     ```
   Do **not** continue until this passes.

---

## Phase 2 — Move SSH to a non-standard port (open firewall + SELinux FIRST)

Pick a high port and use it everywhere below. Example: **52200**.

> Order matters: open the new port in the firewall **and** tell SELinux about it
> **before** sshd listens on it — otherwise sshd can't bind and you could be cut
> off. We keep port 22 open in parallel until the new port is proven.

1. **SELinux** (AlmaLinux is Enforcing) — allow sshd on the new port:
   ```bash
   command -v semanage >/dev/null || dnf install -y policycoreutils-python-utils
   semanage port -a -t ssh_port_t -p tcp 52200
   ```

2. **Open the port in the firewall** — use the variant the audit reported:

   **CSF (default on CWP):** edit `/etc/csf/csf.conf`, add `52200` to BOTH
   `TCP_IN` and `TCP_OUT` (keep `22` for now), then:
   ```bash
   csf -r            # reload rules
   ```

   **firewalld (fallback):**
   ```bash
   firewall-cmd --permanent --add-port=52200/tcp
   firewall-cmd --reload
   ```

3. **Tell sshd to listen on the new port too** (still also on 22). Add a small
   drop-in instead of editing the main file:
   ```bash
   printf 'Port 22\nPort 52200\n' > /etc/ssh/sshd_config.d/10-noc-port.conf
   sshd -t && systemctl restart sshd      # sshd -t aborts on a bad config
   ```

4. **VERIFY GATE 2 — new port works.** From a NEW local terminal:
   ```bash
   ssh -i "$HOME/.ssh/noc_ed25519" -p 52200 root@77.42.66.76 'echo PORT_OK; hostname'
   ```
   Must print `PORT_OK`. Keep sessions A and B open. Don't continue until this passes.

---

## Phase 3 — Turn OFF passwords + lock down sshd (the big one)

Only after GATE 1 and GATE 2 both passed. Write a hardening drop-in:

```bash
cat > /etc/ssh/sshd_config.d/20-noc-hardening.conf <<'EOF'
# NOC SSH hardening - key-only, root via key only
PermitRootLogin prohibit-password
PubkeyAuthentication yes
PasswordAuthentication no
KbdInteractiveAuthentication no
ChallengeResponseAuthentication no
AuthenticationMethods publickey
MaxAuthTries 3
LoginGraceTime 20
X11Forwarding no
EOF
```

Then drop port 22 from sshd (leave only the new port):
```bash
printf 'Port 52200\n' > /etc/ssh/sshd_config.d/10-noc-port.conf
sshd -t && systemctl restart sshd
```

**VERIFY GATE 3 — key-only on the new port, passwords refused.** From a NEW terminal:
```bash
ssh -i "$HOME/.ssh/noc_ed25519" -p 52200 root@77.42.66.76 'echo HARDENED_OK'
# And confirm passwords are dead (should say "Permission denied (publickey)"):
ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no -p 52200 root@77.42.66.76 true
```
First must succeed; second must be rejected. Don't continue until both behave.

Now close port 22 in the firewall:
- **CSF:** remove `22` from `TCP_IN`/`TCP_OUT` in `/etc/csf/csf.conf`, then `csf -r`.
- **firewalld:** `firewall-cmd --permanent --remove-service=ssh; firewall-cmd --reload`

Update your `~/.ssh/config` to uncomment `Port 52200`, then `ssh noc` should just work.

---

## Phase 4 — Auto-ban brute-force attackers

**CSF / LFD (default on CWP)** already bans repeated SSH failures. Just make sure
it's in production mode and active:
```bash
grep -E '^TESTING|^LF_SSHD' /etc/csf/csf.conf   # want TESTING = "0", LF_SSHD = "5"
# if TESTING = "1": set it to "0" in csf.conf, then:
csf -r
systemctl enable --now lfd
systemctl status lfd --no-pager
```

**No CSF? Use fail2ban (firewalld systems only — never run both):**
```bash
dnf install -y fail2ban
cat > /etc/fail2ban/jail.local <<'EOF'
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 4
backend  = systemd

[sshd]
enabled = true
port    = 52200
EOF
systemctl enable --now fail2ban
fail2ban-client status sshd
```

---

## Phase 5 — Automatic security updates

```bash
dnf install -y dnf-automatic
# security-only, auto-applied:
sed -i 's/^upgrade_type =.*/upgrade_type = security/'  /etc/dnf/automatic.conf
sed -i 's/^apply_updates =.*/apply_updates = yes/'     /etc/dnf/automatic.conf
systemctl enable --now dnf-automatic.timer
systemctl list-timers dnf-automatic.timer --no-pager
```
Kernel updates still need a manual reboot during a maintenance window — check with
`needs-restarting -r` (from `dnf install -y yum-utils`).

---

## Phase 6 — Trim the attack surface (low-risk)

1. **MariaDB local-only.** The audit's "MariaDB bind" should be `127.0.0.1` or
   socket-only. If it shows `0.0.0.0:3306`, restrict it:
   ```bash
   echo -e '[mysqld]\nbind-address=127.0.0.1' > /etc/my.cnf.d/zz-noc-bind.cnf
   systemctl restart mariadb
   ```
   (Our `DATABASE_URL` uses `127.0.0.1`, so this won't affect the apps.)

2. **Firewall allow-list sanity (CSF).** `TCP_IN` should list only what you need:
   `52200` (SSH), `80`, `443`, and the **CWP panel ports** (commonly
   `2030,2031,2082,2083,2086,2087`). Do **not** remove the CWP ports or you'll
   lose the panel. Keep `3306` OUT of `TCP_IN`.

---

## Verify it worked (a day later)

```bash
# brute-force noise should stop climbing:
grep -c 'Failed password' /var/log/secure
# CSF: see who got banned
csf -t            # temporary bans
# fail2ban:
fail2ban-client status sshd
```

---

## Rollback (if a new login ever fails)

You still have session A/B open — use them, or the CWP terminal:
```bash
# revert SSH to the saved baseline and restart:
rm -f /etc/ssh/sshd_config.d/10-noc-port.conf /etc/ssh/sshd_config.d/20-noc-hardening.conf
cp -a /root/sshd_config.bak.* /etc/ssh/sshd_config
sshd -t && systemctl restart sshd
# re-open port 22 in the firewall (CSF: add 22 back to TCP_IN then `csf -r`).
```
