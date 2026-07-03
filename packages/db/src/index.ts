import { PrismaClient } from '../generated/prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

// Prisma 7: DB access goes through the mariadb JS driver adapter (no Rust query engine —
// which also ends the old Windows/ARM64 binary-engine workaround).
function mariaDbAdapter() {
  const u = new URL(process.env.DATABASE_URL ?? 'mysql://root@127.0.0.1:3306/noc');
  return new PrismaMariaDb({
    host: u.hostname,
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
    connectionLimit: 10,
  });
}

// HMR-safe singleton: avoid exhausting DB connections during `next dev` reloads.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: mariaDbAdapter(),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Re-export generated types/enums so apps import them from `@noc/db`.
export * from '../generated/prisma/client';
