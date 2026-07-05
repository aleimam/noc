import { prisma } from '@noc/db';

// Queries for the peer negotiation UI. Amounts come back as plain numbers for the client.
type OfferRow = { createdAt: Date; byRole: string; amount: unknown; note: string | null };
const mapOffers = (offers: OfferRow[]) => offers.map((o) => ({ byRole: o.byRole, amount: Number(o.amount), note: o.note }));

/** The current viewer's (buyer's) negotiation thread on a listing, or null. */
export async function getBuyerNegotiation(listingId: string, buyerId: string) {
  const neg = await prisma.negotiation.findUnique({
    where: { listingId_buyerId: { listingId, buyerId } },
    include: { offers: { orderBy: { createdAt: 'asc' } } },
  });
  if (!neg) return null;
  return { id: neg.id, status: neg.status, offers: mapOffers(neg.offers) };
}

/** All negotiations where the user is the buyer (their sent offers). */
export async function listBuyerNegotiations(buyerId: string) {
  const rows = await prisma.negotiation.findMany({
    where: { buyerId },
    orderBy: { updatedAt: 'desc' },
    include: { offers: { orderBy: { createdAt: 'asc' } }, listing: { select: { id: true, title: true, contactPhone: true } } },
  });
  return rows.map((n) => ({
    id: n.id,
    status: n.status,
    offers: mapOffers(n.offers),
    listingId: n.listingId,
    listingTitle: n.listing.title,
    contactPhone: n.listing.contactPhone,
  }));
}

/** All negotiations on the user's own listings (incoming offers as a seller). */
export async function listSellerNegotiations(sellerId: string) {
  const rows = await prisma.negotiation.findMany({
    where: { listing: { sellerId } },
    orderBy: { updatedAt: 'desc' },
    include: {
      offers: { orderBy: { createdAt: 'asc' } },
      listing: { select: { id: true, title: true } },
      buyer: { select: { name: true, phone: true } },
    },
  });
  return rows.map((n) => ({
    id: n.id,
    status: n.status,
    offers: mapOffers(n.offers),
    listingId: n.listingId,
    listingTitle: n.listing.title,
    buyerName: n.buyer.name,
    buyerPhone: n.buyer.phone,
  }));
}
