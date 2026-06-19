import path from 'node:path';

/**
 * Absolute root for uploaded media. `UPLOAD_DIR` (default `./uploads`) is resolved
 * relative to the monorepo root (the dev server runs with cwd = apps/portal).
 * In production set UPLOAD_DIR to an absolute path served by Apache via `Alias`.
 */
export function uploadRoot(): string {
  const value = process.env.UPLOAD_DIR || './uploads';
  if (path.isAbsolute(value)) return value;
  const repoRoot = path.resolve(process.cwd(), '..', '..');
  return path.resolve(repoRoot, value);
}
