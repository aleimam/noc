// Shared Prisma client for seed/maintenance scripts. Run these via `tsx` (see package.json
// scripts) — the Prisma 7 generated client is TypeScript, which plain `node` can't import.
import { PrismaClient } from '../generated/prisma/client.ts';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const u = new URL(process.env.DATABASE_URL ?? 'mysql://root@127.0.0.1:3306/noc');

export const prisma = new PrismaClient({
  adapter: new PrismaMariaDb({
    host: u.hostname,
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
    connectionLimit: 5,
  }),
});
