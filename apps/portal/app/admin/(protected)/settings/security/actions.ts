'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@noc/auth';
import { saveSecurityLevel, saveQuotaOverrides, type QuotaOverrides } from '../../../../../lib/security';

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

export async function setSecurityQuotas(quotas: QuotaOverrides): Promise<{ ok: true } | { ok: false; error: string }> {
  await requirePermission('settings', 'UPDATE');
  try {
    await saveQuotaOverrides(quotas);
    revalidatePath('/admin/settings/security');
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (e) {
    console.error('setSecurityQuotas failed', e);
    return { ok: false, error: 'failed' };
  }
}
