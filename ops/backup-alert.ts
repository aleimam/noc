// Daily backup health check. If the newest database backup is stale (or the last off-site
// push failed), notify the owner by email and/or SMS. Recipients + on/off come from the
// Settings → Backups page (DB setting `backup.alert`). Wrapper: ops/backup-alert.sh; cron 04:00.
//
// Imports the mail/SMS config helpers from the specific otp module (NOT the @noc/auth barrel,
// which would boot NextAuth in this standalone tsx run).
import { prisma } from '@noc/db';
import { sendMail } from '@noc/mail';
import { sendSms } from '@noc/sms';
import { loadMailConfig, loadSmsConfig, normalizePhone } from '../packages/auth/src/otp';
import { readdir, stat, readFile } from 'node:fs/promises';
import path from 'node:path';

const BACKUP_ROOT = process.env.BACKUP_ROOT || '/root/backups';
const MAX_AGE_H = 26; // a daily backup should always be < 24h old; 26 gives slack

async function newestMtime(dir: string): Promise<number | null> {
  try {
    const names = await readdir(dir);
    let newest = 0;
    for (const n of names) {
      if (n.startsWith('.')) continue;
      const st = await stat(path.join(dir, n)).catch(() => null);
      if (st?.isFile() && st.mtimeMs > newest) newest = st.mtimeMs;
    }
    return newest || null;
  } catch {
    return null;
  }
}

async function main() {
  const stamp = new Date().toISOString();
  const row = await prisma.setting.findUnique({ where: { key: 'backup.alert' } });
  const cfg = row?.value ? (JSON.parse(row.value) as { enabled?: boolean; email?: string; phone?: string }) : null;
  if (!cfg?.enabled) {
    console.log(stamp, 'backup alerts disabled — nothing to do');
    return;
  }

  const problems: string[] = [];
  const dbNewest = await newestMtime(path.join(BACKUP_ROOT, 'db'));
  if (!dbNewest) {
    problems.push('No database backup was found on the server.');
  } else {
    const ageH = (Date.now() - dbNewest) / 3.6e6;
    if (ageH > MAX_AGE_H) problems.push(`The latest database backup is ${Math.round(ageH)} hours old (should be under 24h).`);
  }
  try {
    const last = (await readFile(path.join(BACKUP_ROOT, 'offsite.log'), 'utf8')).trim().split('\n').pop() || '';
    if (/ERROR|rsync failed|cannot reach/i.test(last)) problems.push('The last off-site backup push failed: ' + last);
  } catch {
    /* no off-site log yet */
  }

  if (problems.length === 0) {
    console.log(stamp, 'backup healthy');
    return;
  }

  console.log(stamp, 'PROBLEMS:', problems.join(' | '));
  const subject = 'تنبيه النسخ الاحتياطي — NOC backup alert';
  const body = 'تنبيه: مشكلة في النسخ الاحتياطي للعبور الجديد.\nNOC backup problem detected:\n\n- ' + problems.join('\n- ') + '\n\nراجع لوحة الإدارة: /admin/settings/backups';

  if (cfg.email) {
    const r = await sendMail({ to: cfg.email, subject, text: body }, await loadMailConfig()).catch((e) => ({ ok: false, error: String(e) }));
    console.log(stamp, 'email alert ->', JSON.stringify(r));
  }
  if (cfg.phone) {
    const sms = 'تنبيه: النسخة الاحتياطية للعبور الجديد لم تُنشأ كالمعتاد. راجع لوحة الإدارة.';
    const r = await sendSms(normalizePhone(cfg.phone), sms, await loadSmsConfig()).catch((e) => ({ ok: false, error: String(e) }));
    console.log(stamp, 'sms alert ->', JSON.stringify(r));
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
