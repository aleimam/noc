import path from 'node:path';

// Mirror of the portal's upload root resolution. UPLOAD_DIR (default ./uploads) is
// resolved against the monorepo root; uploads are shared across both apps.
export function uploadRoot(): string {
  const value = process.env.UPLOAD_DIR || './uploads';
  if (path.isAbsolute(value)) return value;
  const repoRoot = path.resolve(process.cwd(), '..', '..');
  return path.resolve(repoRoot, value);
}
