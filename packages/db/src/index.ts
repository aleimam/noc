import { PrismaClient } from '@prisma/client';

// HMR-safe singleton: avoid exhausting DB connections during `next dev` reloads.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Re-export generated types/enums so apps import them from `@noc/db`.
export * from '@prisma/client';
