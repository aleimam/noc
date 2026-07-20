import { defineConfig } from 'vitest/config';

// Unit tests for pure logic only (no DB, no network) — today the backup module's
// scheduling/naming/retention, where a mistake skips or DELETES a real backup.
export default defineConfig({
  test: { include: ['packages/**/src/**/*.test.ts'], environment: 'node' },
});
