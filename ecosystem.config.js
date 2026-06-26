/* =========================================================
   PM2 Ecosystem Config — SelectAI Production
   Usage: pm2 start ecosystem.config.js --env production

   IMPORTANT: Secrets (MONGODB_URI, JWT_SECRET, SMTP_*) are
   NOT stored here. Set them via:
     a) System environment variables before starting PM2, or
     b) A .env file in the project root (loaded by dotenv).
   ========================================================= */
module.exports = {
  apps: [
    {
      name:         'selectai-api',
      script:       'server.js',
      instances:    1,
      exec_mode:    'fork',
      watch:        false,
      /* Load .env automatically so PM2 does not need system-level vars */
      env_file:     '.env',
      env_production: {
        NODE_ENV:     'production',
        PORT:         3000,
        TRUST_PROXY:  '1'
      },
      error_file:       'logs/err.log',
      out_file:         'logs/out.log',
      log_date_format:  'YYYY-MM-DD HH:mm:ss Z',
      merge_logs:       true,
      restart_delay:    3000,
      max_restarts:     5,
      min_uptime:       '10s',
      /* Kill timeout — give in-flight requests 10 s to drain before hard kill */
      kill_timeout:     10000
    }
  ]
};
