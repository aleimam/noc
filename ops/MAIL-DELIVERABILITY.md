# Mail deliverability — SPF / DKIM / DMARC + outbound delivery

Status as of 2026-07-09 (VPS 77.42.66.76, CWP/AlmaLinux 9, Postfix 3.5.25). DNS for both
domains is on **Cloudflare** (`zita/bart.ns.cloudflare.com`).

## TL;DR

- **DNS auth records: already correct** — SPF, DKIM (`default._domainkey`), and DMARC (`p=none`)
  are published and resolving for `newobour.com` and `alsawarey.com`.
- **DKIM signing: now ACTIVE + verified** (fixed 2026-07-09, server-side — see below).
- **Actual delivery is still BLOCKED**: Hetzner blocks **outbound port 25**, so the server
  can't deliver direct-to-MX. Owner must pick one path (relay recommended) — see "Remaining".

## Current DNS (published in Cloudflare — verified resolving)

Both `newobour.com` and `alsawarey.com`:

| Record | Name | Value |
|---|---|---|
| SPF | `@` | `v=spf1 +a +mx +ip4:77.42.66.76 ~all` |
| DKIM | `default._domainkey` | `v=DKIM1; k=rsa; p=…` (matches the server's private key — `opendkim-testkey` = "key OK") |
| DMARC | `_dmarc` | `v=DMARC1; p=none` |

No DNS change is needed for signing to work. Changes are only needed **when adding a relay**
(SPF include) and are recommended for DMARC reporting (`rua=`).

## What was fixed server-side on 2026-07-09

1. **Postfix was rejecting ALL mail** — `unsupported dictionary type: mysql` (the stock
   `postfix-3.5.25` had no MySQL dict, but CWP's virtual maps require it). Cleanup aborted every
   message → 2,847 stuck in the queue. **Fix:** `dnf install postfix-mysql-3.5.25-3.el9_8`
   (version-matched, additive, reversible) → `systemctl restart postfix`. Cleanup now processes mail.
2. **OpenDKIM was installed + keyed but disabled and unwired.** **Fix:**
   `systemctl enable --now opendkim`, then wired into Postfix:
   ```
   postconf -e 'milter_default_action = accept'    # never block mail if the signer hiccups
   postconf -e 'smtpd_milters = inet:localhost:8891'
   postconf -e 'non_smtpd_milters = inet:localhost:8891'
   systemctl reload postfix
   ```
   Verified: mail from `@newobour.com` and `@alsawarey.com` now logs
   `DKIM-Signature field added (s=default, d=<domain>)`; system `root@` mail is left unsigned.
3. **Flushed the 2,847-message backlog** (`postsuper -d ALL`) — all undeliverable `root@` cron
   mail + MAILER-DAEMON backscatter to the bogus default domain `noc.yourdomain.com`. Queue empty.

These persist across reboot (opendkim enabled; package installed; config in `main.cf`).

## Remaining — the one real blocker: outbound port 25 (owner decision)

Hetzner blocks outbound TCP/25 by default (anti-spam). CSF already allows it (`TCP_OUT`
includes 25), so it's an **upstream block**, not the firewall. Two ways forward:

### Path A — SMTP relay / smarthost (RECOMMENDED)

Best deliverability for transactional email (OTP, reports); sidesteps the port-25 block (relays
on 587/465) and a small-VPS IP's poor reputation. Pick a provider (Brevo, Mailgun, Amazon SES,
Postmark — most have a free/cheap tier). Then either:

- **A1 — App relays through local Postfix** (uses our own DKIM, already active). Point Postfix at
  the provider as a smarthost:
  ```
  postconf -e 'relayhost = [smtp-relay.brevo.com]:587'
  postconf -e 'smtp_sasl_auth_enable = yes'
  postconf -e 'smtp_sasl_password_maps = hash:/etc/postfix/sasl_passwd'
  postconf -e 'smtp_sasl_security_options = noanonymous'
  postconf -e 'smtp_tls_security_level = encrypt'
  echo '[smtp-relay.brevo.com]:587 USER:PASS' > /etc/postfix/sasl_passwd
  postmap /etc/postfix/sasl_passwd && chmod 600 /etc/postfix/sasl_passwd*
  systemctl reload postfix
  ```
  DNS: add the provider's SPF include, e.g. `v=spf1 +a +mx +ip4:77.42.66.76 include:spf.brevo.com ~all`.
- **A2 — App relays to the provider directly** (nodemailer → provider SMTP; local Postfix not
  involved). Simplest for the app; the provider signs with their DKIM (add their CNAMEs to
  Cloudflare) and you add their SPF include.

**Needs from owner:** provider account + SMTP credentials, and (Cloudflare) the SPF include +
any provider DKIM CNAMEs.

#### Chosen provider: Brevo (free tier, 300 emails/day) — setup

Owner does steps 1–3 (account + DNS); then hand the SMTP key over and the wiring/testing is done
for you via `ops/mail-relay-brevo.sh`.

1. **Create the account** at `https://www.brevo.com` (free "Starter" plan; email + phone verify).
2. **Authenticate the domain** in Brevo → *Senders, Domains & Dedicated IPs > Domains > Add a
   domain* → `newobour.com` (repeat for `alsawarey.com`). Brevo shows 3–4 DNS records — add each
   in **Cloudflare** exactly as shown, **DNS-only (grey cloud)**:
   - a Brevo DKIM record (e.g. `brevo1._domainkey` / `mail._domainkey`),
   - a `brevo-code` domain-verification TXT,
   - **edit the existing SPF** (don't add a second) to include Brevo:
     `v=spf1 +a +mx +ip4:77.42.66.76 include:spf.brevo.com ~all`.
3. **Get the SMTP key**: *SMTP & API > SMTP* → copy the **SMTP server** (`smtp-relay.brevo.com`),
   **port** (587), **login** (looks like `9abc12@smtp-brevo.com`), and **Generate a new SMTP key**.
   Send the **login + key** over (treat the key like a password).
4. **Wire + test** (run for you): `bash ops/mail-relay-brevo.sh apply '<login>' '<key>'` then
   `bash ops/mail-relay-brevo.sh test noc@newobour.com <your-inbox>` → confirm the delivered
   message shows `dkim=pass` and `spf=pass`. Local OpenDKIM keeps signing `d=newobour.com` for
   DMARC alignment; Brevo adds their signature too.

### Path B — ask Hetzner to unblock outbound 25

File a support request from the hosting account to lift the port-25 block, then Postfix can
deliver direct-to-MX with our own SPF/DKIM. Cheaper but weaker deliverability than a relay, and
still needs the PTR/HELO fixes below. **Needs from owner:** the Hetzner support request.

## Also recommended (deliverability polish)

- **PTR / reverse DNS**: currently the Hetzner default (`static.76.66.42.77.clients.your-server.de`).
  Set it to a hostname that has a matching forward A record (e.g. `mail.newobour.com`) in the
  Hetzner control panel. Moot if using Path A2.
- **Postfix identity**: `myhostname = noc`, `mydomain = yourdomain.com` (defaults). A non-FQDN
  HELO is a spam signal. Set to a real FQDN when configuring the relay. This also stops the
  `root@noc.yourdomain.com` cron backscatter (or alias `root` to a real inbox once mail delivers).
- **DMARC**: once a mailbox exists, add `rua=mailto:dmarc@newobour.com` for aggregate reports;
  after monitoring clean, raise `p=none` → `p=quarantine`.

## App integration (when email features land)

Partner email-OTP and analytics scheduled reports both wait on this. Use nodemailer over SMTP —
either `localhost:25` (if Path A1 smarthost is set up; Postfix then DKIM-signs + relays) or the
provider directly (A2). See [waiting-tasks] / [partner-portal] / [web-analytics].

## Verify

```
opendkim-testkey -d newobour.com -s default -vvv        # "key OK" = private key matches DNS
printf 'From: noc@newobour.com\nTo: root@localhost\nSubject: t\n\nx\n' | sendmail -f noc@newobour.com root
grep opendkim /var/log/maillog | tail            # expect: DKIM-Signature field added (s=default, d=newobour.com)
```
After a relay is configured, send to an external address and check the received headers show
`dkim=pass` and `spf=pass` (Gmail: "Show original"), or use a checker like mail-tester.com.
