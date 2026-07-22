#!/usr/bin/env bash
# Wire Postfix to relay outbound mail through Brevo's SMTP relay (free tier: 300/day).
# Credentials are passed as arguments — never hard-code them in this file or the repo.
#
# Apply:   bash ops/mail-relay-brevo.sh apply '<brevo-smtp-login>' '<brevo-smtp-key>'
#            login = the SMTP login shown in Brevo under "SMTP & API > SMTP" (an address like
#                    9abc12@smtp-brevo.com); key = an SMTP key generated there (NOT the account
#                    password).
# ROTATE:  bash ops/mail-relay-brevo.sh rotate            <- PREFERRED for key rotation
#            Reuses the configured login and reads the new key from STDIN (hidden), so the
#            secret never touches argv (/proc-readable) or your shell history. Backs up the
#            old map first; `rollback` restores it if the new key fails to authenticate.
# Rollback: bash ops/mail-relay-brevo.sh rollback
# Test:    bash ops/mail-relay-brevo.sh test  '<from@newobour.com>' '<to@some-inbox.com>'
# Revert:  bash ops/mail-relay-brevo.sh revert
set -euo pipefail

HOST="smtp-relay.brevo.com"
PORT="587"
CMD="${1:-}"

case "$CMD" in
  apply)
    LOGIN="${2:?brevo SMTP login required}"; KEY="${3:?brevo SMTP key required}"
    # Postfix needs the SASL PLAIN/LOGIN client mechanism to authenticate to the relay,
    # else: "SASL authentication failure: No worthy mechs found".
    rpm -q cyrus-sasl-plain >/dev/null 2>&1 || dnf install -y cyrus-sasl-plain
    postconf -e "relayhost = [$HOST]:$PORT"
    postconf -e "smtp_sasl_auth_enable = yes"
    postconf -e "smtp_sasl_password_maps = hash:/etc/postfix/sasl_passwd"
    postconf -e "smtp_sasl_security_options = noanonymous"
    postconf -e "smtp_sasl_mechanism_filter = login, plain"
    postconf -e "smtp_tls_security_level = encrypt"
    umask 077
    printf '[%s]:%s %s:%s\n' "$HOST" "$PORT" "$LOGIN" "$KEY" > /etc/postfix/sasl_passwd
    postmap /etc/postfix/sasl_passwd
    chmod 600 /etc/postfix/sasl_passwd /etc/postfix/sasl_passwd.db
    systemctl reload postfix
    echo "OK: Postfix now relays through $HOST:$PORT. Local OpenDKIM still signs (d=newobour.com/alsawarey.com)."
    ;;
  rotate)
    # Rotate ONLY the SMTP key, reading it from STDIN — never argv. argv is world-readable via
    # /proc while the command runs AND lands in shell history; the same reason dumpDatabase()
    # in packages/backup uses a defaults-file instead of passing the DB password on argv.
    # Keeps a timestamped backup so a bad key can be rolled back in one command.
    LOGIN="${2:-}"
    if [ -z "$LOGIN" ]; then
      # Reuse the login already configured, so only the secret has to be supplied.
      LOGIN=$(sed -nE 's/^\[[^]]+\]:[0-9]+ ([^:]+):.*$/\1/p' /etc/postfix/sasl_passwd 2>/dev/null || true)
      [ -n "$LOGIN" ] || { echo "no existing login found — pass it: $0 rotate <login>" >&2; exit 2; }
      echo "reusing existing SMTP login: $LOGIN" >&2
    fi
    printf 'Paste the NEW Brevo SMTP key (input hidden), then Enter: ' >&2
    read -r -s KEY; printf '\n' >&2
    [ -n "$KEY" ] || { echo "empty key — aborted, nothing changed" >&2; exit 2; }
    BAK="/etc/postfix/sasl_passwd.bak-$(date -u +%Y%m%dT%H%M%SZ)"
    [ -f /etc/postfix/sasl_passwd ] && cp -a /etc/postfix/sasl_passwd "$BAK" && chmod 600 "$BAK"
    umask 077
    printf '[%s]:%s %s:%s\n' "$HOST" "$PORT" "$LOGIN" "$KEY" > /etc/postfix/sasl_passwd
    unset KEY
    postmap /etc/postfix/sasl_passwd
    chmod 600 /etc/postfix/sasl_passwd /etc/postfix/sasl_passwd.db
    systemctl reload postfix
    echo "OK: key rotated. Backup of the previous map: ${BAK:-<none>}"
    echo "Verify with a real send, then DELETE the backup (it holds the OLD secret):"
    echo "  bash $0 test '<from@newobour.com>' '<to@some-inbox.com>'"
    echo "  shred -u ${BAK:-/etc/postfix/sasl_passwd.bak-*}"
    ;;
  rollback)
    # Restore the most recent backup (use if the new key fails to authenticate).
    BAK=$(ls -1t /etc/postfix/sasl_passwd.bak-* 2>/dev/null | head -1 || true)
    [ -n "$BAK" ] || { echo "no backup found" >&2; exit 2; }
    cp -a "$BAK" /etc/postfix/sasl_passwd
    postmap /etc/postfix/sasl_passwd
    chmod 600 /etc/postfix/sasl_passwd /etc/postfix/sasl_passwd.db
    systemctl reload postfix
    echo "Rolled back to $BAK"
    ;;
  test)
    FROM="${2:?from address required}"; TO="${3:?to address required}"
    printf 'From: %s\nTo: %s\nSubject: NOC relay test\n\nBrevo relay + DKIM test.\n' "$FROM" "$TO" | sendmail -f "$FROM" "$TO"
    echo "Sent. Watch delivery:  tail -f /var/log/maillog | grep -iE 'brevo|status=|dkim'"
    echo "Then open the message in the inbox and confirm dkim=pass and spf=pass in the headers."
    ;;
  revert)
    postconf -e "relayhost ="
    postconf -e "smtp_sasl_auth_enable = no"
    rm -f /etc/postfix/sasl_passwd /etc/postfix/sasl_passwd.db
    systemctl reload postfix
    echo "Reverted: relayhost cleared, SASL disabled, credentials removed."
    ;;
  *)
    echo "usage: $0 {apply <login> <key> | rotate [login] | rollback | test <from> <to> | revert}" >&2; exit 2
    ;;
esac
