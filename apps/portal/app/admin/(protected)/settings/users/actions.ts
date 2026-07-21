'use server';

import { revalidatePath } from 'next/cache';
import { auth, requirePermission, hashPassword, normalizePhone, MIN_PASSWORD_LENGTH, SUPER_ADMIN_KEY, WILDCARD } from '@noc/auth';
import { prisma } from '@noc/db';
import { isValidPhone } from '@noc/config';

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

  // Privilege-escalation guards. A plain `staff:UPDATE` grant must NOT be a self-service route
  // to the wildcard role, nor a way to convert a customer/partner row into staff.
  const session = await auth();
  const callerPerms = session?.user?.perms ?? [];
  const roleKeys = [...new Set(input.roleKeys ?? [])].filter(Boolean);
  // Only someone who already holds SUPER_ADMIN (wildcard) may grant SUPER_ADMIN.
  if (roleKeys.includes(SUPER_ADMIN_KEY) && !callerPerms.includes(WILDCARD)) {
    return { ok: false, error: 'forbidden_super_admin' };
  }

  try {
    const base = { type: 'STAFF' as const, email, name: input.name?.trim() || null, isActive: input.isActive ?? true };
    let userId: string;
    if (input.id) {
      // An update must target a row that is ALREADY staff — never re-type another account.
      const existing = await prisma.user.findUnique({ where: { id: input.id }, select: { type: true } });
      if (!existing) return { ok: false, error: 'not_found' };
      if (existing.type !== 'STAFF') return { ok: false, error: 'not_staff' };
      // No self-escalation: you cannot change your own roles here (ask another admin).
      if (input.id === session?.user?.id) {
        const mine = await prisma.userRole.findMany({
          where: { userId: input.id },
          select: { role: { select: { key: true } } },
        });
        const currentKeys = new Set(mine.map((r) => r.role.key));
        const unchanged = roleKeys.length === currentKeys.size && roleKeys.every((k) => currentKeys.has(k));
        if (!unchanged) return { ok: false, error: 'cant_change_own_roles' };
      }
      await prisma.user.update({
        where: { id: input.id },
        data: { ...base, ...(input.password ? { passwordHash: await hashPassword(input.password) } : {}) },
      });
      userId = input.id;
    } else {
      const u = await prisma.user.create({ data: { ...base, passwordHash: await hashPassword(input.password!) } });
      userId = u.id;
    }
    await applyStaffRoles(userId, roleKeys);
    revalidatePath('/admin/settings/users');
    return { ok: true, id: userId };
  } catch (e) {
    return fail(e);
  }
}

export async function upsertCustomer(input: { id?: string; phone: string; name?: string; isActive?: boolean }): Promise<Result> {
  await requirePermission('customers', input.id ? 'UPDATE' : 'CREATE');
  if (!isValidPhone(input.phone)) return { ok: false, error: 'invalid_phone' };
  const phone = normalizePhone(input.phone);
  try {
    const data = { type: 'CUSTOMER' as const, phone, name: input.name?.trim() || null, isActive: input.isActive ?? true };
    if (input.id) {
      // Scope the write to CUSTOMER rows — a `customers` grant must never be able to rewrite
      // (or re-type) a staff/partner account by id.
      const r = await prisma.user.updateMany({ where: { id: input.id, type: 'CUSTOMER' }, data });
      if (r.count === 0) return { ok: false, error: 'not_found' };
    } else await prisma.user.create({ data });
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
    // Scoped to CUSTOMER so verification can never reactivate a disabled staff/partner account,
    // and only a positive verification activates (un-verifying must not flip isActive on).
    const r = await prisma.user.updateMany({
      where: { id, type: 'CUSTOMER' },
      data: { phoneVerifiedAt: verified ? new Date() : null, ...(verified ? { isActive: true } : {}) },
    });
    if (r.count === 0) return { ok: false, error: 'not_found' };
    revalidatePath('/admin/settings/customers');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteUser(id: string): Promise<Result> {
  const u = await prisma.user.findUnique({ where: { id }, select: { type: true } });
  if (!u) return { ok: false, error: 'not_found' };
  // Partner logins belong to Owner records → gated by the `owners` section (the old
  // `partners` key was retired in the 2026-07 RBAC restructure).
  const section = u.type === 'CUSTOMER' ? 'customers' : u.type === 'PARTNER' ? 'owners' : 'staff';
  await requirePermission(section, 'DELETE');
  const session = await auth();
  if (session?.user?.id === id) return { ok: false, error: 'cant_delete_self' };
  try {
    await prisma.user.delete({ where: { id } });
    revalidatePath('/admin/settings/users');
    revalidatePath('/admin/settings/customers');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
