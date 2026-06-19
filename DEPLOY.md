# Deploying NOC (newobour.com + alsawarey.com)

Two Next.js apps from one monorepo, sharing one MySQL/MariaDB backend, served behind
Apache as two subdomains. **Port 3000 is already used on the server — use other ports
(3001 / 3002).** Verify they're free first: `ss -tlnp | grep -E ':(3001|3002)'`.

## Server prerequisites
- Node.js 20+ and npm, **PM2** (`npm i -g pm2`)
- MySQL/MariaDB with a `noc` database and a dedicated user
- Apache with `mod_proxy`, `mod_proxy_http`, `mod_headers` enabled
- Allow native install scripts during `npm install` so Prisma's engine builds:
  `npm install` then `npm rebuild` if your npm gates lifecycle scripts.

## 1. Code + dependencies
```bash
git clone https://github.com/aleimam/noc.git && cd noc
npm install
```

## 2. Environment (`.env` at repo root — see `.env.example`)
```ini
DATABASE_URL="mysql://noc_user:STRONG_PW@127.0.0.1:3306/noc"
AUTH_SECRET="<openssl rand -base64 32>"
SMS_PROVIDER="smsmisr"          # or victorylink / twilio — plus that provider's keys
UPLOAD_DIR="/home/USER/noc/uploads"   # ABSOLUTE in production (served by Apache below)
SUPERADMIN_EMAIL="admin@newobour.com"
SUPERADMIN_PASSWORD="<change>"
PORTAL_URL="https://newobour.com"
BROKERAGE_URL="https://alsawarey.com"
```

## 3. Database + build
```bash
npm run db:generate
npm run -w @noc/db migrate:deploy   # applies committed migrations (no dev prompts)
npm run db:seed                     # permissions + SUPER_ADMIN + bootstrap staff
npm run build
```
> Prisma uses `engineType = "binary"` (required for the Windows/ARM64 dev machine; works
> on Linux too). For a small perf gain on a Linux-only server you may drop that line in
> `packages/db/prisma/schema.prisma` and re-`db:generate` to use the native library engine.

## 4. Run both apps with PM2 (ports 3001 / 3002)
`ecosystem.config.js` at the repo root:
```js
module.exports = {
  apps: [
    { name: 'noc-portal',    cwd: './apps/portal',    script: 'npm', args: 'run start', env: { NODE_ENV: 'production' } },
    { name: 'noc-brokerage', cwd: './apps/brokerage', script: 'npm', args: 'run start', env: { NODE_ENV: 'production' } },
  ],
};
```
(`start` scripts already pin `-p 3001` / `-p 3002`.)
```bash
pm2 start ecosystem.config.js && pm2 save && pm2 startup
```

## 5. Apache virtual hosts (reverse proxy + uploads)
Each subdomain proxies to its Node port; both serve `/uploads/*` straight from disk.
```apache
<VirtualHost *:80>
  ServerName newobour.com
  ServerAlias www.newobour.com

  Alias /uploads /home/USER/noc/uploads
  <Directory /home/USER/noc/uploads>
    Require all granted
    Options -Indexes
  </Directory>

  ProxyPreserveHost On
  ProxyPass        /uploads !
  ProxyPass        /  http://127.0.0.1:3001/
  ProxyPassReverse /  http://127.0.0.1:3001/
</VirtualHost>
```
Repeat for **alsawarey.com** → `http://127.0.0.1:3002/` (same `/uploads` Alias — media is shared).
Then add TLS (Let's Encrypt / `certbot`) and reload Apache.

## Updating a release
```bash
git pull && npm install && npm run -w @noc/db migrate:deploy && npm run build && pm2 reload all
```

## Notes
- **SMS:** `SMS_PROVIDER=console` only logs codes (dev). Production needs a real Egyptian
  gateway (SMSMisr / VictoryLink) or Twilio, with an approved sender ID, and a provider
  adapter implemented in `packages/sms/src/index.ts`.
- **Uploads** live outside the build (`UPLOAD_DIR`) and are git-ignored; back them up
  separately. Apache serves them so Node isn't in the static-file path.
- **Secrets:** never commit `.env`; rotate `AUTH_SECRET` only during a maintenance window
  (it invalidates existing sessions).
