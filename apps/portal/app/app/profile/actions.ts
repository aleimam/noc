'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@noc/auth';
import { prisma } from '@noc/db';

// Lets a signed-in customer update their own display name. Phone is the login
// identity (OTP-verified, unique) and is intentionally not editable here.
export async function updateProfile(formData: FormData): Promise<{ ok: boolean }> {
  const session = await auth();
  if (session?.user?.type !== 'CUSTOMER') return { ok: false };

  const name = String(formData.get('name') ?? '')
    .trim()
    .slice(0, 120);

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name: name || null },
  });

  revalidatePath('/app/profile');
  revalidatePath('/app');
  return { ok: true };
}
