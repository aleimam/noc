// Seed: RBAC permissions (section × action), a SUPER_ADMIN role holding every
// permission, and a bootstrap staff user from env. Plain ESM so it runs under
// `node` directly (no tsx/esbuild needed). Idempotent via upserts.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SECTIONS = [
  'homepage',
  'staff',
  'customers',
  'partners',
  'media',
  'settings',
  'sheets',
  'lands',
  'districts',
  'owners',
  'commissions',
];
const ACTIONS = ['VIEW', 'CREATE', 'UPDATE', 'DELETE', 'MANAGE'];

async function main() {
  // 1) Permissions: every section × action pair.
  for (const section of SECTIONS) {
    for (const action of ACTIONS) {
      await prisma.permission.upsert({
        where: { section_action: { section, action } },
        update: {},
        create: { section, action },
      });
    }
  }
  const allPerms = await prisma.permission.findMany();

  // 2) SUPER_ADMIN role with every permission.
  const superAdmin = await prisma.role.upsert({
    where: { key: 'SUPER_ADMIN' },
    update: { name: 'Super Admin' },
    create: {
      key: 'SUPER_ADMIN',
      name: 'Super Admin',
      description: 'Full access to every section.',
    },
  });
  for (const perm of allPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: superAdmin.id, permissionId: perm.id } },
      update: {},
      create: { roleId: superAdmin.id, permissionId: perm.id },
    });
  }

  // 3) Bootstrap staff super-admin from env.
  const email = process.env.SUPERADMIN_EMAIL;
  const password = process.env.SUPERADMIN_PASSWORD;
  if (email && password) {
    const passwordHash = await bcrypt.hash(password, 10);
    const admin = await prisma.user.upsert({
      where: { email },
      update: { passwordHash, isActive: true },
      create: { type: 'STAFF', email, passwordHash, name: 'Super Admin', isActive: true },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: admin.id, roleId: superAdmin.id } },
      update: {},
      create: { userId: admin.id, roleId: superAdmin.id },
    });
    console.log(`✓ Bootstrap staff super-admin: ${email}`);
  } else {
    console.warn('! SUPERADMIN_EMAIL/PASSWORD not set — skipped bootstrap staff user.');
  }

  console.log(`✓ Seeded ${SECTIONS.length * ACTIONS.length} permissions and SUPER_ADMIN role.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
