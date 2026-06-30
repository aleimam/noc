'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@noc/auth';
import { saveCalculatorConfig } from '../../../../../lib/calculator/config';
import type { CalculatorConfig } from '../../../../../lib/calculator/calc';

export async function saveCalcSettings(cfg: CalculatorConfig): Promise<{ ok: true } | { ok: false; error: string }> {
  await requirePermission('settings', 'UPDATE');
  try {
    await saveCalculatorConfig(cfg);
    revalidatePath('/admin/settings/calculator');
    revalidatePath('/calculator');
    return { ok: true };
  } catch (e) {
    console.error('saveCalcSettings failed', e);
    return { ok: false, error: 'failed' };
  }
}
