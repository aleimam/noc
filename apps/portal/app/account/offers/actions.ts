'use server';

import { revalidatePath } from 'next/cache';
import { auth, loadSmsConfig } from '@noc/auth';
import { prisma } from '@noc/db';
import { sendSms } from '@noc/sms';

type Result = { ok: true } | { ok: false; error: string };

// Best-effort SMS to the counterparty; never fails the action.
async function notify(phone: string | null | undefined, text: string) {
  if (!phone) return;
  try {
    const cfg = await loadSmsConfig();
    await sendSms(phone, text, cfg);
  } catch (e) {
    console.error('negotiation SMS failed', e);
  }
}

/** Buyer opens (or re-opens) a negotiation on a listing with a price offer. */
export async function makeOffer(listingId: string, amount: number, note?: string): Promise<Result> {
  const session = await auth();
  const user = session?.user;
  if (!user || user.type !== 'CUSTOMER') return { ok: false, error: 'unauthorized' };
  if (!(amount > 0)) return { ok: false, error: 'invalid_amount' };
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { id: true, sellerId: true, status: true, title: true, contactPhone: true, seller: { select: { phone: true } } },
  });
  if (!listing || listing.status !== 'PUBLISHED') return { ok: false, error: 'not_found' };
  if (listing.sellerId === user.id) return { ok: false, error: 'own_listing' };

  const neg = await prisma.negotiation.upsert({
    where: { listingId_buyerId: { listingId, buyerId: user.id } },
    update: { status: 'OPEN' },
    create: { listingId, buyerId: user.id, status: 'OPEN' },
  });
  await prisma.negotiationOffer.create({ data: { negotiationId: neg.id, byRole: 'BUYER', amount, note: note?.trim() || null } });

  await notify(listing.seller?.phone || listing.contactPhone, `العبور الجديد: عرض سعر جديد على «${listing.title}». راجعه في حسابك.`);
  revalidatePath(`/market/${listingId}`);
  revalidatePath('/account/offers');
  return { ok: true };
}

/** Either party responds: accept / reject / counter (new price) / withdraw (buyer only). */
export async function respondNegotiation(
  negotiationId: string,
  action: 'accept' | 'reject' | 'counter' | 'withdraw',
  amount?: number,
  note?: string,
): Promise<Result> {
  const session = await auth();
  const user = session?.user;
  if (!user) return { ok: false, error: 'unauthorized' };
  const neg = await prisma.negotiation.findUnique({
    where: { id: negotiationId },
    include: {
      listing: { select: { id: true, sellerId: true, title: true, contactPhone: true, seller: { select: { phone: true } } } },
      buyer: { select: { id: true, phone: true } },
    },
  });
  if (!neg) return { ok: false, error: 'not_found' };
  const isSeller = neg.listing.sellerId === user.id;
  const isBuyer = neg.buyerId === user.id;
  if (!isSeller && !isBuyer) return { ok: false, error: 'forbidden' };
  if (neg.status !== 'OPEN' && action !== 'counter') return { ok: false, error: 'closed' };

  const sellerPhone = neg.listing.seller?.phone || neg.listing.contactPhone;
  const buyerPhone = neg.buyer.phone;
  const other = isSeller ? buyerPhone : sellerPhone;
  const title = neg.listing.title;

  if (action === 'withdraw') {
    if (!isBuyer) return { ok: false, error: 'forbidden' };
    await prisma.negotiation.update({ where: { id: neg.id }, data: { status: 'WITHDRAWN' } });
  } else if (action === 'accept') {
    await prisma.negotiation.update({ where: { id: neg.id }, data: { status: 'ACCEPTED' } });
    await notify(other, `العبور الجديد: تم قبول العرض على «${title}». تواصلوا لإتمام البيع.`);
  } else if (action === 'reject') {
    await prisma.negotiation.update({ where: { id: neg.id }, data: { status: 'REJECTED' } });
    await notify(other, `العبور الجديد: تم رفض العرض على «${title}».`);
  } else if (action === 'counter') {
    if (!(amount && amount > 0)) return { ok: false, error: 'invalid_amount' };
    await prisma.negotiationOffer.create({ data: { negotiationId: neg.id, byRole: isSeller ? 'SELLER' : 'BUYER', amount, note: note?.trim() || null } });
    await prisma.negotiation.update({ where: { id: neg.id }, data: { status: 'OPEN' } });
    await notify(other, `العبور الجديد: عرض مضاد جديد على «${title}». راجعه في حسابك.`);
  }

  revalidatePath('/account/offers');
  revalidatePath(`/market/${neg.listing.id}`);
  return { ok: true };
}
