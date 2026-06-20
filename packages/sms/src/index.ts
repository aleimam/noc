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

/** Human-readable reasons for SMS Misr API response codes (success is 1901). */
const SMSMISR_CODES: Record<string, string> = {
  '1901': 'Success',
  '1902': 'Invalid request — a required parameter is missing or malformed',
  '1903': 'Invalid username or password',
  '1904': 'Invalid Sender ID — it must be a sender name approved on your SMS Misr account',
  '1905': 'Invalid mobile number',
  '1906': 'Insufficient balance / credit',
  '1907': 'SMS Misr server is under maintenance',
  '1908': 'Invalid date & time',
  '1909': 'Invalid message content',
  '1910': 'Invalid language',
  '1911': 'Message text is too long',
  '1912': 'Invalid environment value',
};

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
    const code = String(json.code ?? 'unknown');
    const ok = code === '1901';
    const reason = SMSMISR_CODES[code];
    return {
      id: String(json.SMSID ?? `smsmisr-${Date.now()}`),
      ok,
      error: ok ? undefined : reason ? `${code} — ${reason}` : `code_${code}`,
    };
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
