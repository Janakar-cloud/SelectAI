/* =========================================================
   PM2 Ecosystem Config — SelectAI Production
   Usage: pm2 start ecosystem.config.js --env production
   ========================================================= */
module.exports = {
  apps: [
    {
      name:         'selectai-api',
      script:       'server.js',
      instances:    1,
      exec_mode:    'fork',
      watch:        false,
      env_production: {
        NODE_ENV: 'production',
        PORT:     3000
      },
      error_file:       'logs/err.log',
      out_file:         'logs/out.log',
      log_date_format:  'YYYY-MM-DD HH:mm:ss Z',
      merge_logs:       true,
      restart_delay:    3000,
      max_restarts:     5,
      min_uptime:       '10s'
    }
  ]
};
