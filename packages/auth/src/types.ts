import type { UserType } from '@noc/db';

// Augment Auth.js types with our custom fields. Type-only (no runtime Prisma
// import), so this stays safe to load in the edge middleware. The JWT shape is
// handled via a local cast in config.base.ts (the 'next-auth/jwt' augmentation
// module doesn't resolve cleanly under Bundler resolution).
declare module 'next-auth' {
  interface User {
    type?: UserType;
    perms?: string[];
  }
  interface Session {
    user: {
      id: string;
      type: UserType;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      perms: string[];
    };
  }
}
