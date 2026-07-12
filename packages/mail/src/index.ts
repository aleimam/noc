/**
 * Provider-agnostic transactional email. Config is passed in by the caller (which loads it from
 * the admin Settings table / env), so no secrets live in this package. The default transport is
 * the local Postfix on 127.0.0.1:25, which DKIM-signs and relays outbound via the configured
 * smarthost — see ops/MAIL-DELIVERABILITY.md.
 */
import nodemailer from 'nodemailer';

export type MailConfig = {
  provider: string; // 'console' | 'smtp'
  host?: string; // default 127.0.0.1
  port?: number; // default 25
  user?: string; // set only if the transport requires auth
  pass?: string;
  from?: string; // default 'العبور الجديدة <no-reply@newobour.com>'
  secure?: boolean; // default false (opportunistic STARTTLS)
};

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface MailResult {
  ok: boolean;
  id?: string;
  error?: string;
}

const DEFAULT_FROM = 'العبور الجديدة <no-reply@newobour.com>';

function logConsole(m: MailMessage): MailResult {
  // eslint-disable-next-line no-console
  console.info(`\n──────── EMAIL ────────\n→ ${m.to}\nSubject: ${m.subject}\n\n${m.text}\n───────────────────────\n`);
  return { ok: true, id: `console-${Date.now()}` };
}

/** Send one email. Never throws — returns { ok:false, error } so callers can decide. */
export async function sendMail(msg: MailMessage, cfg: MailConfig): Promise<MailResult> {
  if (!cfg.provider || cfg.provider === 'console') return logConsole(msg);
  try {
    const transport = nodemailer.createTransport({
      host: cfg.host || '127.0.0.1',
      port: cfg.port ?? 25,
      secure: cfg.secure ?? false,
      auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
      // Local relay presents a self-signed cert on STARTTLS; don't fail on it.
      tls: { rejectUnauthorized: false },
    });
    const info = await transport.sendMail({
      from: cfg.from || DEFAULT_FROM,
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
    });
    return { ok: true, id: info.messageId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'send_failed' };
  }
}
