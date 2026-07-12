// Seed: RBAC permissions (section × action), a SUPER_ADMIN role holding every
// permission, and a bootstrap staff user from env. Plain ESM so it runs under
// `node` directly (no tsx/esbuild needed). Idempotent via upserts.
import { prisma } from './db-client.mjs';
import bcrypt from 'bcryptjs';


// Keep in sync with SECTIONS in packages/config/src/index.ts (12-key model, 2026-07
// restructure — migration 20260712160000_rbac_sections re-keyed existing grants).
const SECTIONS = [
  'sheets',
  'lands',
  'listings',
  'catalog',
  'owners',
  'storefront',
  'content',
  'appearance',
  'analytics',
  'staff',
  'customers',
  'settings',
];
const ACTIONS = ['VIEW', 'CREATE', 'UPDATE', 'DELETE', 'MANAGE'];

// Fixed role presets (Super Admin is seeded separately with every permission).
const ROLE_PRESETS = [
  {
    key: 'LISTINGS_MODERATOR',
    name: 'مشرف عروض / Listings moderator',
    perms: [['listings', 'VIEW'], ['listings', 'UPDATE']],
  },
  {
    key: 'CONTENT_EDITOR',
    name: 'محرر محتوى / Content editor',
    perms: [['content', 'MANAGE']],
  },
  {
    key: 'STORE_MANAGER',
    name: 'مدير المتجر / Store manager',
    perms: [['storefront', 'MANAGE'], ['listings', 'VIEW']],
  },
  {
    key: 'RATIONING_CLERK',
    name: 'مسؤول التقنين / Rationing clerk',
    perms: [['sheets', 'MANAGE']],
  },
  {
    key: 'GEO_EDITOR',
    name: 'محرر الدليل الجغرافي / Geo editor',
    perms: [['lands', 'MANAGE']],
  },
];

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

  // 4) Fixed role presets. Recreate each role's permission set so preset edits apply on re-seed.
  const permByKey = new Map(allPerms.map((p) => [`${p.section}:${p.action}`, p.id]));
  for (const preset of ROLE_PRESETS) {
    const role = await prisma.role.upsert({
      where: { key: preset.key },
      update: { name: preset.name },
      create: { key: preset.key, name: preset.name },
    });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    const data = preset.perms
      .map(([section, action]) => permByKey.get(`${section}:${action}`))
      .filter(Boolean)
      .map((permissionId) => ({ roleId: role.id, permissionId }));
    if (data.length) await prisma.rolePermission.createMany({ data });
  }

  // 5) Default static pages per brand (created once, unpublished, for staff to fill).
  const PAGE_DEFAULTS = [
    { slug: 'about', titleAr: 'من نحن', titleEn: 'About us', order: 1 },
    { slug: 'contact', titleAr: 'اتصل بنا', titleEn: 'Contact us', order: 2 },
    { slug: 'privacy', titleAr: 'سياسة الخصوصية', titleEn: 'Privacy Policy', order: 3 },
    { slug: 'terms', titleAr: 'الشروط والأحكام', titleEn: 'Terms of Service', order: 4 },
  ];
  for (const brand of ['newobour', 'alsawarey']) {
    for (const p of PAGE_DEFAULTS) {
      await prisma.page.upsert({
        where: { brand_slug: { brand, slug: p.slug } },
        update: {}, // never overwrite staff edits
        create: { brand, slug: p.slug, titleAr: p.titleAr, titleEn: p.titleEn, bodyAr: '', bodyEn: '', published: false, footerOrder: p.order },
      });
    }
  }

  console.log(`✓ Seeded ${SECTIONS.length * ACTIONS.length} permissions, SUPER_ADMIN + ${ROLE_PRESETS.length} roles, default pages.`);
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
