import { prisma } from '@noc/db';

// Public ad reference: 7 digits `YY MM ####`, frozen once set, based on the listing's
// creation month. The 5th digit picks the family:
//   • Coded owners (Us 00–09, Company/Broker 10–79): `YY MM CC S` — CC = an allocated
//     2-digit code, S = a per-code monthly sequence 1–9 (≈9 ads/code/month). An owner may
//     hold several codes; we fill them in ascending order and overflow to the next.
//   • Personal owners: no code — `YY MM NNN` where NNN runs a shared monthly pool 800–999.
export async function ensureAdNumber(listingId: string): Promise<string | null> {
  const l = await prisma.listing.findUnique({
    where: { id: listingId },
    select: {
      id: true,
      adNumber: true,
      createdAt: true,
      ownerType: true,
      owner: { select: { type: true, codes: { select: { code: true }, orderBy: { code: 'asc' } } } },
    },
  });
  if (!l) return null;
  if (l.adNumber) return l.adNumber;

  const d = l.createdAt;
  const yy = String(d.getFullYear() % 100).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const ym = `${yy}${mm}`; // 4 chars

  const type = l.owner?.type ?? l.ownerType ?? 'PERSONAL';

  // Personal (or unspecified) → shared 800–999 monthly pool.
  if (type === 'PERSONAL') {
    for (let n = 800; n <= 999; n++) {
      const candidate = `${ym}${n}`;
      try {
        await prisma.listing.update({ where: { id: listingId }, data: { adNumber: candidate } });
        return candidate;
      } catch {
        // taken — try the next number in the pool
      }
    }
    return null; // pool exhausted for the month
  }

  // Coded owner → fill the owner's allocated codes in order, each holding sequences 1–9.
  const codes = l.owner?.codes.map((c) => c.code) ?? [];
  if (!codes.length) return null; // admin must allocate a code first
  for (const code of codes) {
    const prefix = `${ym}${String(code).padStart(2, '0')}`; // 6 chars
    const used = await prisma.listing.count({ where: { adNumber: { startsWith: prefix } } });
    for (let seq = used + 1; seq <= 9; seq++) {
      const candidate = `${prefix}${seq}`;
      try {
        await prisma.listing.update({ where: { id: listingId }, data: { adNumber: candidate } });
        return candidate;
      } catch {
        // race/clash — try the next sequence in this code
      }
    }
  }
  return null; // all allocated codes are full for the month
}
