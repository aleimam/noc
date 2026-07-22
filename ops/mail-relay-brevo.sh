#!/usr/bin/env bash
# Wire Postfix to relay outbound mail through Brevo's SMTP relay (free tier: 300/day).
# Credentials are passed as arguments — never hard-code them in this file or the repo.
#
# Apply:   bash ops/mail-relay-brevo.sh apply '<brevo-smtp-login>' '<brevo-smtp-key>'
#            login = the SMTP login shown in Brevo under "SMTP & API > SMTP" (an address like
#                    9abc12@smtp-brevo.com); key = an SMTP key generated there (NOT the account
#                    password).
# VERIFY:  bash ops/mail-relay-brevo.sh verify            <- ALWAYS run this FIRST
#            Tests a candidate key against the relay WITHOUT touching Postfix, so a bad key
#            can never interrupt live mail. Reports pass/fail + key shape (a 535 is usually a
#            v3 API key 'xkeysib-…' pasted instead of an SMTP key).
# ROTATE:  bash ops/mail-relay-brevo.sh rotate            <- only after verify passes
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
  verify)
    # Test a candidate credential against the relay WITHOUT touching Postfix config, so a bad
    # key can never interrupt live mail (OTP, backup alerts). Reads the key from STDIN, reports
    # only pass/fail + the server's reply, and also describes the key's SHAPE — the usual cause
    # of a 535 is pasting a v3 API key (`xkeysib-…`) instead of an SMTP key.
    LOGIN="${2:-}"
    if [ -z "$LOGIN" ]; then
      LOGIN=$(sed -nE 's/^\[[^]]+\]:[0-9]+ ([^:]+):.*$/\1/p' /etc/postfix/sasl_passwd 2>/dev/null || true)
      [ -n "$LOGIN" ] || { echo "no existing login found — pass it: $0 verify <login>" >&2; exit 2; }
    fi
    printf 'Paste the key to TEST (input hidden), then Enter: ' >&2
    read -r -s KEY; printf '\n' >&2
    [ -n "$KEY" ] || { echo "empty key — aborted" >&2; exit 2; }
    KEY="$KEY" LOGIN="$LOGIN" HOST="$HOST" PORT="$PORT" python3 - <<'PY'
import os, smtplib, ssl, sys
key, login = os.environ["KEY"], os.environ["LOGIN"]
host, port = os.environ["HOST"], int(os.environ["PORT"])
# Shape hints only — never the value itself.
shape = "looks like a v3 API key (xkeysib-…) — that is NOT an SMTP key" if key.startswith("xkeysib-") else "no xkeysib- prefix (consistent with an SMTP key)"
print(f"  login    : {login}")
print(f"  key len  : {len(key)} chars, {shape}")
if key != key.strip():
    print("  ⚠ key has leading/trailing whitespace — likely a copy/paste artefact")
try:
    s = smtplib.SMTP(host, port, timeout=20)
    s.starttls(context=ssl.create_default_context())
    s.login(login, key)
    s.quit()
    print("  RESULT   : ✅ AUTH OK — safe to apply with `rotate`")
except smtplib.SMTPAuthenticationError as e:
    print(f"  RESULT   : ❌ AUTH REJECTED — {e.smtp_code} {e.smtp_error.decode(errors='replace') if isinstance(e.smtp_error, bytes) else e.smtp_error}")
    sys.exit(1)
except Exception as e:
    print(f"  RESULT   : ❌ connection/other error — {type(e).__name__}: {e}")
    sys.exit(1)
PY
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
    echo "usage: $0 {apply <login> <key> | verify [login] | rotate [login] | rollback | test <from> <to> | revert}" >&2; exit 2
    ;;
esac
