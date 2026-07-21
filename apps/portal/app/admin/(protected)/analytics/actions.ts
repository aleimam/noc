'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@noc/db';
import { auth, requirePermission } from '@noc/auth';

type Result = { ok: true } | { ok: false; error: string };

const DAYS = [7, 14, 30, 90, 365];
const SITES = ['all', 'newobour', 'alsawarey'];

/** Save the current dashboard filters (days + site) as a named, staff-shared preset. */
export async function saveAnalyticsView(name: string, days: number, site: string): Promise<Result> {
  // Saved views are shared staff state — creating one is a write, not a read.
  await requirePermission('analytics', 'CREATE');
  const n = name.trim().slice(0, 60);
  if (!n) return { ok: false, error: 'name_required' };
  const session = await auth();
  await prisma.analyticsSavedView.create({
    data: {
      name: n,
      days: DAYS.includes(days) ? days : 30,
      site: SITES.includes(site) ? site : 'all',
      createdById: session?.user?.id ?? null,
    },
  });
  revalidatePath('/admin/analytics');
  return { ok: true };
}

/** Delete a saved view. */
export async function deleteAnalyticsView(id: string): Promise<Result> {
  // Deleting a shared preset must not be possible with a read-only analytics grant.
  await requirePermission('analytics', 'DELETE');
  await prisma.analyticsSavedView.delete({ where: { id } }).catch(() => {});
  revalidatePath('/admin/analytics');
  return { ok: true };
}
