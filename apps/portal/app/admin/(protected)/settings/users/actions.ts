'use server';

import { revalidatePath } from 'next/cache';
import { auth, requirePermission, hashPassword, normalizePhone, MIN_PASSWORD_LENGTH } from '@noc/auth';
import { prisma } from '@noc/db';

type Result = { ok: true; id?: string } | { ok: false; error: string };

function fail(e: unknown): Result {
  const code = (e as { code?: string })?.code;
  if (code === 'P2002') return { ok: false, error: 'duplicate' };
  console.error('user action failed', e);
  return { ok: false, error: 'failed' };
}

/** Assign the chosen roles to a staff user (replaces any existing roles + legacy direct perms). */
async function applyStaffRoles(userId: string, roleKeys: string[]) {
  await prisma.userRole.deleteMany({ where: { userId } });
  await prisma.userPermission.deleteMany({ where: { userId } }); // drop legacy per-section grants
  const keys = [...new Set(roleKeys)].filter(Boolean);
  if (keys.length) {
    const roles = await prisma.role.findMany({ where: { key: { in: keys } }, select: { id: true } });
    if (roles.length) await prisma.userRole.createMany({ data: roles.map((r) => ({ userId, roleId: r.id })) });
  }
}

export async function upsertStaff(input: {
  id?: string;
  email: string;
  name?: string;
  password?: string;
  isActive?: boolean;
  roleKeys?: string[];
}): Promise<Result> {
  await requirePermission('staff', input.id ? 'UPDATE' : 'CREATE');
  const email = input.email.trim().toLowerCase();
  if (!email) return { ok: false, error: 'email_required' };
  if (input.password && input.password.length < MIN_PASSWORD_LENGTH) return { ok: false, error: 'password_short' };
  if (!input.id && !input.password) return { ok: false, error: 'password_required' };
  try {
    const base = { type: 'STAFF' as const, email, name: input.name?.trim() || null, isActive: input.isActive ?? true };
    let userId: string;
    if (input.id) {
      await prisma.user.update({
        where: { id: input.id },
        data: { ...base, ...(input.password ? { passwordHash: await hashPassword(input.password) } : {}) },
      });
      userId = input.id;
    } else {
      const u = await prisma.user.create({ data: { ...base, passwordHash: await hashPassword(input.password!) } });
      userId = u.id;
    }
    await applyStaffRoles(userId, input.roleKeys ?? []);
    revalidatePath('/admin/settings/users');
    return { ok: true, id: userId };
  } catch (e) {
    return fail(e);
  }
}

export async function upsertCustomer(input: { id?: string; phone: string; name?: string; isActive?: boolean }): Promise<Result> {
  await requirePermission('customers', input.id ? 'UPDATE' : 'CREATE');
  const phone = normalizePhone(input.phone);
  if (!/^\+?\d{8,15}$/.test(phone)) return { ok: false, error: 'invalid_phone' };
  try {
    const data = { type: 'CUSTOMER' as const, phone, name: input.name?.trim() || null, isActive: input.isActive ?? true };
    if (input.id) await prisma.user.update({ where: { id: input.id }, data });
    else await prisma.user.create({ data });
    revalidatePath('/admin/settings/customers');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// Confirm (or un-confirm) a customer created by the no-login follow flow.
export async function setCustomerVerified(id: string, verified: boolean): Promise<Result> {
  await requirePermission('customers', 'UPDATE');
  try {
    await prisma.user.update({
      where: { id },
      data: { phoneVerifiedAt: verified ? new Date() : null, isActive: true },
    });
    revalidatePath('/admin/settings/customers');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function upsertPartner(input: {
  id?: string;
  name: string;
  phone?: string;
  email?: string;
  partnerKind: 'BROKER' | 'COMPANY';
  isActive?: boolean;
}): Promise<Result> {
  await requirePermission('partners', input.id ? 'UPDATE' : 'CREATE');
  const name = input.name.trim();
  if (!name) return { ok: false, error: 'name_required' };
  try {
    const data = {
      type: 'PARTNER' as const,
      name,
      phone: input.phone?.trim() ? normalizePhone(input.phone) : null,
      email: input.email?.trim().toLowerCase() || null,
      partnerKind: input.partnerKind,
      isActive: input.isActive ?? true,
    };
    if (input.id) await prisma.user.update({ where: { id: input.id }, data });
    else await prisma.user.create({ data });
    revalidatePath('/admin/settings/partners');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteUser(id: string): Promise<Result> {
  const u = await prisma.user.findUnique({ where: { id }, select: { type: true } });
  if (!u) return { ok: false, error: 'not_found' };
  const section = u.type === 'CUSTOMER' ? 'customers' : u.type === 'PARTNER' ? 'partners' : 'staff';
  await requirePermission(section, 'DELETE');
  const session = await auth();
  if (session?.user?.id === id) return { ok: false, error: 'cant_delete_self' };
  try {
    await prisma.user.delete({ where: { id } });
    revalidatePath('/admin/settings/users');
    revalidatePath('/admin/settings/customers');
    revalidatePath('/admin/settings/partners');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
