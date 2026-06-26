#!/usr/bin/env bash
# Read-only audit of the server's security + backup posture. Changes NOTHING.
# Run as root on the production server and paste the WHOLE output back:
#
#     bash /root/noc/ops/audit.sh
#
# It tells us which firewall is in play (CSF vs firewalld), the live sshd
# settings, whether a root SSH key is installed, what's listening, how much
# brute-force traffic is hitting SSH, and whether backups/auto-updates exist.
set +e
sec() { printf '\n========== %s ==========\n' "$*"; }

sec "Host / kernel"
hostnamectl 2>/dev/null | sed -n '1,8p'
uname -r

sec "SELinux mode"
getenforce 2>/dev/null || echo "getenforce not available"

sec "Firewall - CSF (ConfigServer, usual on CWP)"
if command -v csf >/dev/null 2>&1; then
  csf -v 2>/dev/null
  echo "-- key csf.conf settings --"
  grep -E '^[[:space:]]*(TESTING|TCP_IN|TCP_OUT|LF_SSHD|PORTFLOOD|CONNLIMIT)[[:space:]]*=' /etc/csf/csf.conf 2>/dev/null
  echo "-- lfd (login failure daemon): $(systemctl is-active lfd 2>/dev/null)"
else
  echo "CSF not installed"
fi

sec "Firewall - firewalld"
if command -v firewall-cmd >/dev/null 2>&1; then
  echo "active: $(systemctl is-active firewalld 2>/dev/null)"
  firewall-cmd --list-all 2>/dev/null
else
  echo "firewalld not installed"
fi

sec "fail2ban"
if command -v fail2ban-client >/dev/null 2>&1; then
  echo "active: $(systemctl is-active fail2ban 2>/dev/null)"
  fail2ban-client status 2>/dev/null
else
  echo "fail2ban not installed"
fi

sec "Effective sshd config (the values that are actually live)"
if sshd -T >/tmp/_sshdT 2>/dev/null; then
  grep -Ei '^(port|listenaddress|permitrootlogin|passwordauthentication|pubkeyauthentication|kbdinteractiveauthentication|challengeresponseauthentication|maxauthtries|logingracetime|x11forwarding|usepam) ' /tmp/_sshdT
  rm -f /tmp/_sshdT
else
  echo "(sshd -T failed; showing non-comment lines of sshd_config)"
  grep -vE '^[[:space:]]*(#|$)' /etc/ssh/sshd_config 2>/dev/null
fi

sec "root authorized_keys (need at least one BEFORE disabling passwords)"
if [ -s /root/.ssh/authorized_keys ]; then
  awk '{print NR": type="$1" comment="$NF}' /root/.ssh/authorized_keys
else
  echo "NONE - no SSH key installed for root yet"
fi

sec "Listening TCP sockets"
ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null

sec "MariaDB bind (want 127.0.0.1 only, not 0.0.0.0)"
ss -tlnp 2>/dev/null | grep -E '[:.]3306' || echo "3306 not listening on TCP (socket-only is fine and safest)"

sec "SSH brute-force activity"
echo "Failed-password lines in /var/log/secure: $(grep -c 'Failed password' /var/log/secure 2>/dev/null)"
echo "btmp bad-login entries: $(lastb 2>/dev/null | grep -c .)"

sec "Automatic security updates"
systemctl is-enabled dnf-automatic.timer 2>/dev/null || echo "dnf-automatic.timer NOT enabled"

sec "Existing backups / cron"
ls -lh /root/backups/db /root/backups/uploads 2>/dev/null || echo "no /root/backups yet"
if [ -f /etc/cron.d/noc-backup ]; then echo "-- /etc/cron.d/noc-backup --"; cat /etc/cron.d/noc-backup; else echo "no noc-backup cron yet"; fi

sec "Disk"
df -h / /root 2>/dev/null

echo; echo "AUDIT COMPLETE - copy everything above and paste it back."
