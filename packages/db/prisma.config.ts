// Prisma 7 config (replaces the old package.json#prisma block). Env vars are injected by
// the npm scripts (`dotenv -e ../../.env --`), so no dotenv import is needed here.
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.mjs',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
