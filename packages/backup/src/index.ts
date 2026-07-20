// Server-only module — never import this from a 'use client' component.
// The admin UI imports it in server actions / server components; ops/backup-tick.ts
// imports it in a standalone tsx run (hence: no 'server-only' anywhere in here).
export * from './logic';
export { encryptSecret, decryptSecret } from './secret-box';
export { runTier, runDueBackups, runAllTiersNow, testConnection, APP_PREFIX } from './service';
export type { RunTrigger, RunResult } from './service';
