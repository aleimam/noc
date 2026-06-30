'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@noc/auth';
import { saveModuleVisibility } from '../../../../../lib/modules';

export async function setModules(map: Record<string, boolean>): Promise<{ ok: true } | { ok: false; error: string }> {
  await requirePermission('settings', 'UPDATE');
  try {
    await saveModuleVisibility(map);
    revalidatePath('/admin/settings/modules');
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (e) {
    console.error('setModules failed', e);
    return { ok: false, error: 'failed' };
  }
}
