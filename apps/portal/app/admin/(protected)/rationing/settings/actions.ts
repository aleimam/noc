'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { normalizeArabic } from '../../../../../lib/rationing/text';
import { saveRationingConfig, type RationingConfig } from '../../../../../lib/rationing/settings';

type Result = { ok: true } | { ok: false; error: string };

function fail(e: unknown): Result {
  const code = (e as { code?: string })?.code;
  if (code === 'P2002') return { ok: false, error: 'duplicate' };
  console.error('rationing settings action failed', e);
  return { ok: false, error: 'failed' };
}

export async function upsertCity(input: { id?: string; name: string; nameEn?: string; order?: number; isActive?: boolean }): Promise<Result> {
  await requirePermission('sheets', 'UPDATE');
  const name = input.name?.trim();
  if (!name) return { ok: false, error: 'name_required' };
  const normalized = normalizeArabic(name);
  if (!normalized) return { ok: false, error: 'name_required' };
  try {
    const data = { name, nameEn: input.nameEn?.trim() || null, normalized, order: input.order ?? 0, isActive: input.isActive ?? true };
    if (input.id) await prisma.rationingCity.update({ where: { id: input.id }, data });
    else await prisma.rationingCity.create({ data });
    revalidatePath('/admin/rationing/settings');
    revalidatePath('/rationing');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteCity(id: string): Promise<Result> {
  await requirePermission('sheets', 'DELETE');
  try {
    // sheets keep their data; cityId is set null by the FK (onDelete: SetNull).
    await prisma.rationingCity.delete({ where: { id } });
    revalidatePath('/admin/rationing/settings');
    revalidatePath('/rationing');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function saveConfig(cfg: Partial<RationingConfig>): Promise<Result> {
  await requirePermission('sheets', 'UPDATE');
  try {
    await saveRationingConfig(cfg);
    revalidatePath('/admin/rationing/settings');
    revalidatePath('/rationing');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
