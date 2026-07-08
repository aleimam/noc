# Deploying NOC (newobour.com + alsawarey.com)

Two Next.js apps from one monorepo sharing one MariaDB backend, served behind **Nginx**
as two domains. This documents the live production setup (CWP / AlmaLinux 9 VPS).
**Port 3000 is taken on the server — the apps use 3001 (portal) / 3002 (brokerage).**

## Server prerequisites
- Node.js 20+ and npm, **PM2** (`npm i -g pm2`)
- MariaDB with a `noc` database and a dedicated user
- Nginx owning :80/:443 (on CWP, Apache may be present but unused)
- Allow native install scripts during `npm install` (sharp needs its prebuilt binaries)

## 1. Code + dependencies
```bash
git clone https://github.com/aleimam/noc.git && cd noc
npm install
```

## 2. Environment (`.env` at repo root — see `.env.example`)
```ini
DATABASE_URL="mysql://noc_user:STRONG_PW@127.0.0.1:3306/noc"
AUTH_SECRET="<openssl rand -base64 32>"
SMS_PROVIDER="smsmisr"                # + that provider's keys (sender TOKEN, not name)
UPLOAD_DIR="/root/noc/uploads"        # ABSOLUTE in production
SUPERADMIN_EMAIL="admin@newobour.com"
SUPERADMIN_PASSWORD="<change>"
PORTAL_URL="https://newobour.com"     # also pins AUTH_URL behind the proxy
BROKERAGE_URL="https://alsawarey.com"
```

## 3. Database + build (first install)
```bash
npm run db:generate
npm run db:migrate:deploy   # applies committed migrations (no dev prompts)
npm run db:seed:all         # permissions + SUPER_ADMIN + marketplace catalog + districts
npm run build
```
> Prisma 7 uses the Rust-free client + `@prisma/adapter-mariadb`; the client is generated
> into `packages/db/generated/prisma/` by `db:generate`/build. Re-running seeds is
> idempotent, and the marketplace seed does **not** touch attribute-applicability links
> unless `SEED_ATTR_LINKS=1` (admins own those in the UI).

## 4. Run both apps with PM2 (ports 3001 / 3002)
`ecosystem.config.js` is committed at the repo root.
```bash
pm2 start ecosystem.config.js && pm2 save && pm2 startup
```

## 5. Nginx reverse proxy
Live config: `/etc/nginx/conf.d/noc.conf` — one HTTP→HTTPS redirect block + one SSL
block per domain, proxying to the app port.

**CWP gotcha:** CWP's default-SSL vhost listens on wildcard `0.0.0.0:443 default_server`
and hijacks any block using a bare `listen 443 ssl`. Bind the **specific server IP**
instead: `listen 77.42.66.76:443 ssl;` (and `listen 77.42.66.76:80;`).

Key lines inside each SSL block (TLS = one Let's Encrypt SAN cert for both domains):
```nginx
location / {
    proxy_pass http://127.0.0.1:3001;          # 3002 for alsawarey.com
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;  # Auth.js needs this over TLS
}
client_max_body_size 35m;                        # uploads
```
**Uploads** are served by the portal's own `/uploads/*` route (UPLOAD_DIR under /root
isn't readable by the web-server user); the brokerage adds
`location /uploads { proxy_pass http://127.0.0.1:3001; }`.

## Updating a release
```bash
cd /root/noc && git pull && npm install && npm run db:release && npm run build && pm2 reload all
```
`db:release` = migrate-deploy → **generate** → seed-marketplace, **in that order** (the
seed uses the generated client, so generate must come first). It never runs the base
seed, so the admin password is never reset. Skip `npm install`/`db:release` for
code-only changes (`git pull && npm run build && pm2 reload all`).

Recovery if a deploy fails mid-way:
```bash
npm run db:generate && npm run db:seed:marketplace && npm run build && pm2 reload all
```

## Notes
- **Migrations are written on Windows but run on case-SENSITIVE Linux MySQL** — table
  names in hand-written SQL must be PascalCase (`Listing`, not `listing`).
- **SMS:** production uses SMS Misr — the API `sender` parameter is the **sender TOKEN**
  (hash), not the display name; language=1 for pure-ASCII, 2 for Arabic.
- **Ops:** backups, restore drills, hardening and the Cloudflare runbook live in
  [ops/](ops/README.md). Nightly DB+uploads backups run at 02:30 via `/etc/cron.d/noc-backup`.
- **Secrets:** never commit `.env`; rotate `AUTH_SECRET` only in a maintenance window
  (it invalidates sessions).
