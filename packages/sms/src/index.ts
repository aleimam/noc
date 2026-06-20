/**
 * Provider-agnostic SMS sending. Credentials are passed in by the caller (which
 * loads them from the admin Settings table), so no secrets live in this package.
 */
export interface SmsResult {
  id: string;
  ok: boolean;
  error?: string;
}

export type SmsConfig = {
  provider: string; // 'console' | 'smsmisr'
  username?: string;
  password?: string;
  sender?: string;
  environment?: string; // SMS Misr: '1' = live, '2' = test
};

function logConsole(to: string, body: string): SmsResult {
  // eslint-disable-next-line no-console
  console.info(`\n──────── SMS ────────\n→ ${to}\n${body}\n─────────────────────\n`);
  return { id: `console-${Date.now()}`, ok: true };
}

/** SMS Misr (sms.com.eg) — form-POST to /api/SMS/. Success response code is "1901". */
async function sendViaSmsMisr(to: string, body: string, cfg: SmsConfig): Promise<SmsResult> {
  if (!cfg.username || !cfg.password || !cfg.sender) {
    return { id: 'smsmisr-unconfigured', ok: false, error: 'missing_credentials' };
  }
  const mobile = to.replace(/^\+/, ''); // E.164 +201… → 201…
  const params = new URLSearchParams({
    environment: cfg.environment || '1',
    username: cfg.username,
    password: cfg.password,
    sender: cfg.sender,
    mobile,
    language: '1',
    message: body,
  });
  try {
    const res = await fetch('https://smsmisr.com/api/SMS/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const json = (await res.json().catch(() => ({}))) as { code?: string | number; SMSID?: string | number };
    const ok = String(json.code) === '1901';
    return { id: String(json.SMSID ?? `smsmisr-${Date.now()}`), ok, error: ok ? undefined : `code_${json.code ?? 'unknown'}` };
  } catch (e) {
    return { id: 'smsmisr-error', ok: false, error: e instanceof Error ? e.message : 'request_failed' };
  }
}

/** Send an SMS via the configured provider; defaults to logging on the console. */
export async function sendSms(to: string, body: string, config?: SmsConfig): Promise<SmsResult> {
  const provider = config?.provider || process.env.SMS_PROVIDER || 'console';
  if (provider === 'smsmisr') return sendViaSmsMisr(to, body, config ?? { provider });
  return logConsole(to, body);
}
