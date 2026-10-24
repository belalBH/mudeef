// PM2 process file: pm2 start ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'mudeef',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      instances: 1, // keep one instance: SQLite and the background sync expect a single process
      autorestart: true,
      max_memory_restart: '500M',
      env: { NODE_ENV: 'production' },
    },
  ],
};
