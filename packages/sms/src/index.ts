/**
 * Provider-agnostic SMS sending. The OTP service depends only on `SmsProvider`,
 * so the console stub can be swapped for a real Egyptian gateway (SMSMisr,
 * VictoryLink) or Twilio without touching any call site.
 */
export interface SmsResult {
  id: string;
  ok: boolean;
}

export interface SmsProvider {
  readonly name: string;
  sendSms(to: string, body: string): Promise<SmsResult>;
}

/** Dev/default provider: logs to the server console. Never sends paid SMS. */
export class ConsoleSmsProvider implements SmsProvider {
  readonly name = 'console';
  async sendSms(to: string, body: string): Promise<SmsResult> {
    // eslint-disable-next-line no-console
    console.info(`\n──────── SMS ────────\n→ ${to}\n${body}\n─────────────────────\n`);
    return { id: `console-${Date.now()}`, ok: true };
  }
}

export type SmsProviderName = 'console' | 'smsmisr' | 'victorylink' | 'twilio';

let cached: SmsProvider | null = null;

/** Returns the configured provider (singleton). Real adapters plug in here later. */
export function getSmsProvider(): SmsProvider {
  if (cached) return cached;
  const name = (process.env.SMS_PROVIDER ?? 'console') as SmsProviderName;
  switch (name) {
    // case 'smsmisr':     cached = new SmsMisrProvider(); break;
    // case 'victorylink': cached = new VictoryLinkProvider(); break;
    // case 'twilio':      cached = new TwilioProvider(); break;
    case 'console':
    default:
      cached = new ConsoleSmsProvider();
  }
  return cached;
}
