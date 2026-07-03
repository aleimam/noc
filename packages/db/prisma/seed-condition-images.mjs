// Attach the 6 branded الصواري condition sheets (209/276/350/400/450/500 m²) to their pages.
// The PNGs live in the repo (prisma/condition-images) so this is reproducible on prod too.
// Copies each into the uploads root and sets the condition's `images` — only when empty, so
// it never clobbers photos an admin later curated in the editor. Idempotent.
import { prisma } from './db-client.mjs';
import { mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';


// Mirror apps/portal/lib/uploads.ts uploadRoot() (cwd here = packages/db, 2 levels below root).
function uploadRoot() {
  const v = process.env.UPLOAD_DIR || './uploads';
  return path.isAbsolute(v) ? v : path.resolve(process.cwd(), '..', '..', v);
}

const NUMS = [209, 276, 350, 400, 450, 500];

async function main() {
  const destDir = path.join(uploadRoot(), 'conditions');
  await mkdir(destDir, { recursive: true });
  let attached = 0;
  for (const num of NUMS) {
    const slug = `land-${num}`;
    const cond = await prisma.buildingCondition.findUnique({ where: { slug }, select: { id: true, images: true } });
    if (!cond) {
      console.log(`  ${slug}: no page — skipped`);
      continue;
    }
    const src = path.resolve(process.cwd(), 'prisma', 'condition-images', `${num}.png`);
    await copyFile(src, path.join(destDir, `${num}.png`));
    const publicPath = `/uploads/conditions/${num}.png`;
    const current = Array.isArray(cond.images) ? cond.images : [];
    if (current.length) {
      console.log(`  ${slug}: already has ${current.length} image(s) — file refreshed, list left as-is`);
      continue;
    }
    await prisma.buildingCondition.update({ where: { id: cond.id }, data: { images: [publicPath] } });
    attached++;
    console.log(`  ${slug}: attached ${publicPath}`);
  }
  console.log(`Done. ${attached} sheet(s) attached.`);
}

main()
  .catch((e) => {
    console.error('seed-condition-images failed', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
