import { prisma } from '@noc/db';
import { AREA_PRESETS } from '@noc/config';

export const STANDARD_AREAS_KEY = 'marketplace.standardAreas';

/** Admin-editable list of standard plot areas (m²) used to round Allocated-Area details.
 *  Falls back to the built-in presets when unset. */
export async function getStandardAreas(): Promise<number[]> {
  const row = await prisma.setting.findFirst({ where: { key: STANDARD_AREAS_KEY } });
  if (row?.value) {
    try {
      const arr = JSON.parse(row.value);
      if (Array.isArray(arr)) {
        const nums = arr.map(Number).filter((n) => Number.isFinite(n) && n > 0);
        if (nums.length) return [...new Set(nums)].sort((a, b) => a - b);
      }
    } catch {
      /* fall through to defaults */
    }
  }
  return [...AREA_PRESETS];
}
