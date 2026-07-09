#!/usr/bin/env bash
# Wire Postfix to relay outbound mail through Brevo's SMTP relay (free tier: 300/day).
# Credentials are passed as arguments — never hard-code them in this file or the repo.
#
# Apply:  bash ops/mail-relay-brevo.sh apply '<brevo-smtp-login>' '<brevo-smtp-key>'
#           login = the SMTP login shown in Brevo under "SMTP & API > SMTP" (an address like
#                   9abc12@smtp-brevo.com); key = an SMTP key generated there (NOT the account
#                   password).
# Test:   bash ops/mail-relay-brevo.sh test  '<from@newobour.com>' '<to@some-inbox.com>'
# Revert: bash ops/mail-relay-brevo.sh revert
set -euo pipefail

HOST="smtp-relay.brevo.com"
PORT="587"
CMD="${1:-}"

case "$CMD" in
  apply)
    LOGIN="${2:?brevo SMTP login required}"; KEY="${3:?brevo SMTP key required}"
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
    echo "usage: $0 {apply <login> <key> | test <from> <to> | revert}" >&2; exit 2
    ;;
esac
