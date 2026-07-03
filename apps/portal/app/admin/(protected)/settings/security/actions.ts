'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@noc/auth';
import { saveSecurityLevel } from '../../../../../lib/security';

export async function setSecurityLevel(level: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requirePermission('settings', 'UPDATE');
  try {
    await saveSecurityLevel(level);
    revalidatePath('/admin/settings/security');
    revalidatePath('/', 'layout'); // public pages read the posture on every request
    return { ok: true };
  } catch (e) {
    console.error('setSecurityLevel failed', e);
    return { ok: false, error: 'failed' };
  }
}
