// PM2 process file — runs both Next.js apps in production.
// Portal → newobour.com (port 3001), Brokerage → alsawarey.com (port 3002).
// Port 3000 is taken on the server; verify these are free first:
//   ss -tlnp | grep -E ':(3001|3002)'
// (to change a port, edit the matching app's `start` script in package.json).
//
// Usage (from the repo root, after `npm run build`):
//   pm2 start ecosystem.config.js && pm2 save && pm2 startup
//   pm2 reload all          # after a new release
module.exports = {
  apps: [
    {
      name: 'noc-portal',
      cwd: './apps/portal',
      script: 'npm',
      args: 'run start', // next start -p 3001
      // NOC_SITE tells @noc/auth which brand this process serves (partner-portal site gate).
      env: { NODE_ENV: 'production', NOC_SITE: 'newobour' },
      max_memory_restart: '512M',
      time: true,
    },
    {
      name: 'noc-brokerage',
      cwd: './apps/brokerage',
      script: 'npm',
      args: 'run start', // next start -p 3002
      // NOC_SITE=alsawarey → the partner-portal login gate here requires siteAlsawary access.
      env: { NODE_ENV: 'production', NOC_SITE: 'alsawarey' },
      max_memory_restart: '512M',
      time: true,
    },
  ],
};
