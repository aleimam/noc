import { prisma } from '@noc/db';

// Public ad reference: YY MM OWNER(2) SEQ — 7 digits, e.g. 2606301.
// Frozen once set, based on the listing's creation date; sequence resets monthly per owner.
// Requires the owner to have an allocated `ownerNo` (admin sets it; our lands use 00-09).
export async function ensureAdNumber(listingId: string): Promise<string | null> {
  const l = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { id: true, adNumber: true, createdAt: true, owner: { select: { ownerNo: true } } },
  });
  if (!l) return null;
  if (l.adNumber) return l.adNumber;
  const ownerNo = l.owner?.ownerNo;
  if (ownerNo == null) return null; // no allocated owner number yet → skip (admin must set it)

  const d = l.createdAt;
  const yy = String(d.getFullYear() % 100).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const ownerPad = String(ownerNo).padStart(2, '0');
  const prefix = `${yy}${mm}${ownerPad}`; // 6 chars; seq appended → 7 for seq 1-9

  // monthly per-owner sequence = how many ad numbers already share this prefix
  for (let attempt = 0; attempt < 5; attempt++) {
    const count = await prisma.listing.count({ where: { adNumber: { startsWith: prefix } } });
    const candidate = `${prefix}${count + 1 + attempt}`;
    try {
      await prisma.listing.update({ where: { id: listingId }, data: { adNumber: candidate } });
      return candidate;
    } catch {
      // unique clash (race) — retry with next sequence
    }
  }
  return null;
}
