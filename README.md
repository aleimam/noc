# NOC — New Obour platform

A bilingual (Arabic‑first, RTL) platform for New Obour City, built as one monorepo with
**two front‑ends sharing one backend**:

- **`apps/portal`** → **newobour.com** — the free community services portal (brand: العبور الجديد / New Obour Real Estate)
- **`apps/brokerage`** → **alsawarey.com** — the Al Sawarey (الصواري) real‑estate brokerage

## Stack
Next.js 15 (App Router) · React 19 · Tailwind v4 · TypeScript · Prisma + MySQL/MariaDB ·
Auth.js v5 (JWT) · next‑intl · Turborepo + npm workspaces.

```
apps/        portal, brokerage                (Next.js apps)
packages/    db, auth, i18n, ui, sms, config  (shared)
Identity/    brand assets (logos, palette)
.devdb/      local portable MariaDB           (git-ignored)
uploads/     user media                       (git-ignored)
```

## Local development

**Prereqs:** Node 20+ (this repo was built on Node 24 / Windows ARM64).

```bash
npm install
npm run db:start        # launches the bundled portable MariaDB on 127.0.0.1:3306
cp .env.example .env    # then fill values (local DATABASE_URL already matches the dev DB)
npm run db:generate
npm run db:migrate      # first time: append -- --name init
npm run db:seed         # permissions + SUPER_ADMIN + bootstrap staff
npm run dev             # portal → http://localhost:3001 , brokerage → http://localhost:3002
```

**Try it:**
- Staff admin → http://localhost:3001/admin/login → `admin@newobour.com` / `changeme123`
- Customer → http://localhost:3001/app/login → any phone; the OTP code prints to the **dev terminal** (SMS_PROVIDER=console)

## Scripts
| Command | What |
|---|---|
| `npm run dev` | both apps in dev (Turbopack) |
| `npm run build` | production build |
| `npm run lint` | ESLint |
| `npm run db:start` | start the local MariaDB |
| `npm run db:migrate` / `db:seed` / `db:studio` | Prisma migrate / seed / Studio |

## Notes / gotchas
- **Prisma 7 (Rust‑free client):** the generated client lives at
  `packages/db/generated/prisma/` (git‑ignored; rebuilt by `db:generate`/build) and DB
  access goes through the pure‑JS `@prisma/adapter-mariadb` driver — no query‑engine
  binary, so it runs natively on Windows ARM64 and Linux alike. The connection URL is
  read in `packages/db/prisma.config.ts` (not the schema). Seeds run via `tsx`.
- **Local DB** is a portable MariaDB under `.devdb/` (git‑ignored). If `:3306` is down,
  run `npm run db:start`.
- **OTP codes** print to the dev terminal until a real SMS provider is configured
  (production uses SMS Misr).
- **Uploads** land in `uploads/yyyy/mm/` and are served by the portal's own
  `/uploads/*` route in dev **and** production (the brokerage proxies `/uploads` to the
  portal) — see **[DEPLOY.md](DEPLOY.md)**.
- Single shared color palette (navy `#0B1B33` / gold `#C9983E` accent / green `#2F9E7D`
  status‑only) lives in `packages/ui/src/styles/theme.css`.
- Server operations (backups, hardening, Cloudflare) live in **[ops/](ops/README.md)**.
