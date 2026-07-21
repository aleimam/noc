'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@noc/auth';
import { regenerateListingImages, listListingImages, type GenImage } from '../../../../../../lib/poster/generate';

export type { GenImage };
type Result = { ok: true } | { ok: false; error: string };

/** (Re)generate the full image set (poster ×3, card per group ×2, advantages ×2) for a listing. */
export async function generateListingPosters(listingId: string): Promise<Result> {
  await requirePermission('listings', 'UPDATE');
  try {
    await regenerateListingImages(listingId);
    revalidatePath(`/admin/marketplace/listings/${listingId}/edit`);
    return { ok: true };
  } catch (e) {
    console.error('generateListingPosters failed', e);
    return { ok: false, error: 'failed' };
  }
}

export async function listListingPosters(listingId: string): Promise<GenImage[]> {
  // Exported server action → reachable directly. Without this gate it returned internal
  // generated-media paths for ANY listing id (including drafts and trashed rows).
  await requirePermission('listings', 'VIEW');
  return listListingImages(listingId);
}
