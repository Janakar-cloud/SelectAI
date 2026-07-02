#!/usr/bin/env bash
# Emergency nginx recovery — run when site shows ERR_CONNECTION_REFUSED
# Usage:  cd /var/www/SelectAI && sudo bash deploy/recover-nginx.sh

set -uo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  exec sudo bash "$0" "$@"
fi

APP_ROOT="/var/www/SelectAI"
NGINX_AVAILABLE="/etc/nginx/sites-available/selectai"
NGINX_ENABLED="/etc/nginx/sites-enabled/selectai"

echo ""
echo "============================================================"
echo " SelectAI nginx recovery"
echo "============================================================"
echo ""

echo "── 1. nginx service status ──"
systemctl status nginx --no-pager -l 2>&1 | head -20 | sed 's/^/  /' || true
echo ""

echo "── 2. nginx config test ──"
if nginx -t 2>&1 | sed 's/^/  /'; then
  CONFIG_OK=1
else
  CONFIG_OK=0
  echo "  *** nginx config is INVALID ***"
fi
echo ""

echo "── 3. Recent nginx errors ──"
journalctl -u nginx -n 30 --no-pager 2>&1 | sed 's/^/  /' || true
echo ""

echo "── 4. Ports listening (80 / 443) ──"
ss -tlnp | grep -E ':80|:443' | sed 's/^/  /' || echo "  (nothing on 80/443 — nginx is down)"
echo ""

echo "── 5. SSL certificate paths ──"
SSL_CERT=""
SSL_KEY=""
for dir in /etc/letsencrypt/live/www.selectai.it.com \
           /etc/letsencrypt/live/selectai.it.com; do
  if [[ -f "${dir}/fullchain.pem" && -f "${dir}/privkey.pem" ]]; then
    SSL_CERT="${dir}/fullchain.pem"
    SSL_KEY="${dir}/privkey.pem"
    echo "  Found: ${SSL_CERT}"
    break
  fi
done
[[ -z "$SSL_CERT" ]] && echo "  WARNING: no Let's Encrypt cert found"
echo ""

SSL_OPTS=""
[[ -f /etc/letsencrypt/options-ssl-nginx.conf ]] && SSL_OPTS="include /etc/letsencrypt/options-ssl-nginx.conf;"
SSL_DHPARAM=""
[[ -f /etc/letsencrypt/ssl-dhparams.pem ]] && SSL_DHPARAM="ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;"

echo "── 6. Writing safe nginx config ──"
mkdir -p /etc/nginx/backup/recover-$(date +%Y%m%d-%H%M%S)
[[ -f "$NGINX_AVAILABLE" ]] && cp -a "$NGINX_AVAILABLE" /etc/nginx/backup/recover-$(date +%Y%m%d-%H%M%S)/ 2>/dev/null || true

if [[ -n "$SSL_CERT" ]]; then
  cat > "${NGINX_AVAILABLE}" <<NGINX_EOF
# SelectAI — recovered by deploy/recover-nginx.sh
server {
    listen 80;
    listen [::]:80;
    server_name selectai.com www.selectai.com selectai.it.com www.selectai.it.com;
    access_log /var/log/nginx/selectai-access.log;
    error_log  /var/log/nginx/selectai-error.log;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name selectai.com www.selectai.com selectai.it.com www.selectai.it.com;

    root ${APP_ROOT};
    index index.html;

    access_log /var/log/nginx/selectai-access.log;
    error_log  /var/log/nginx/selectai-error.log;

    ssl_certificate     ${SSL_CERT};
    ssl_certificate_key ${SSL_KEY};
    ${SSL_OPTS}
    ${SSL_DHPARAM}

    location = / { try_files /index.html =404; }

    location = /index.html  { return 301 /\$is_args\$args; }
    location = /login.html  { return 301 /welcome\$is_args\$args; }
    location = /signin.html { return 301 /sign-in\$is_args\$args; }
    location ~ ^/(.+)\.html\$ { return 301 /\$1\$is_args\$args; }

    location = /sign-in { try_files /signin.html =404; }
    location = /welcome { try_files /login.html =404; }

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        try_files \$uri \$uri.html \$uri/ =404;
    }
}
NGINX_EOF
else
  echo "  No SSL — writing HTTP-only config on port 80"
  cat > "${NGINX_AVAILABLE}" <<NGINX_EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name selectai.com www.selectai.com selectai.it.com www.selectai.it.com _;
    root ${APP_ROOT};
    index index.html;
    access_log /var/log/nginx/selectai-access.log;
    error_log  /var/log/nginx/selectai-error.log;
    location = / { try_files /index.html =404; }
    location = /sign-in { try_files /signin.html =404; }
    location = /welcome { try_files /login.html =404; }
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    location / { try_files \$uri \$uri.html \$uri/ =404; }
}
NGINX_EOF
fi

ln -sf "${NGINX_AVAILABLE}" "${NGINX_ENABLED}"
rm -f /etc/nginx/sites-enabled/default

echo "  Config: ${NGINX_AVAILABLE}"
echo ""

echo "── 7. Test & start nginx ──"
if ! nginx -t 2>&1 | sed 's/^/  /'; then
  echo ""
  echo "  FATAL: config still invalid. Restoring last backup..."
  LATEST=$(ls -td /etc/nginx/backup/*/ 2>/dev/null | head -1)
  if [[ -n "$LATEST" && -f "${LATEST}/selectai" ]]; then
    cp -a "${LATEST}/selectai" "${NGINX_AVAILABLE}"
    nginx -t && systemctl restart nginx
  else
    echo "  No backup found. Check: sudo journalctl -u nginx -n 50"
    exit 1
  fi
else
  systemctl restart nginx
fi

sleep 2
echo ""
echo "── 8. Verify ──"
systemctl is-active nginx && echo "  nginx: RUNNING" || echo "  nginx: NOT RUNNING"
ss -tlnp | grep -E ':80|:443' | sed 's/^/  /' || true
curl -skI -H "Host: www.selectai.it.com" https://127.0.0.1/ 2>/dev/null | head -5 | sed 's/^/  /' \
  || curl -sI -H "Host: www.selectai.it.com" http://127.0.0.1/ 2>/dev/null | head -5 | sed 's/^/  /' || true

echo ""
echo "── 9. PM2 API (optional) ──"
if command -v pm2 >/dev/null 2>&1; then
  pm2 list 2>/dev/null | sed 's/^/  /' || true
  pm2 describe selectai-api 2>/dev/null | grep -E "status|restarts" | sed 's/^/  /' || \
    echo "  (selectai-api not in pm2 — run: cd ${APP_ROOT} && pm2 start ecosystem.config.js)"
fi

echo ""
echo "Done. Try https://www.selectai.it.com in your browser."
echo "If still down, check AWS Security Group allows inbound TCP 80 and 443."
echo ""
