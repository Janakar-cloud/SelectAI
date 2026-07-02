#!/usr/bin/env bash
# SelectAI — diagnose & fix homepage routing on the server
# Run on EC2:  cd /var/www/SelectAI && sudo bash deploy/fix-homepage.sh

set -euo pipefail

APP_ROOT="/var/www/SelectAI"
NGINX_SITE="selectai"
NGINX_AVAILABLE="/etc/nginx/sites-available/${NGINX_SITE}"
NGINX_ENABLED="/etc/nginx/sites-enabled/${NGINX_SITE}"

echo ""
echo "============================================================"
echo " SelectAI homepage diagnostic"
echo "============================================================"
echo ""

echo "── 1. Static files (nginx serves these, NOT PM2) ──"
for f in index.html login.html signin.html js/root-redirect.js; do
  if [[ -f "${APP_ROOT}/${f}" ]]; then
    echo "  OK  ${f}"
  else
    echo "  MISSING  ${f}  ← run: cd ${APP_ROOT} && git pull origin main"
  fi
done
echo ""

echo "── 2. PM2 (API only — port 3000, does NOT serve HTML pages) ──"
if command -v pm2 >/dev/null 2>&1; then
  pm2 list 2>/dev/null || sudo pm2 list 2>/dev/null || true
  echo "  Page hits will NOT appear in /var/www/SelectAI/logs/out.log"
  echo "  API hits (e.g. POST /api/auth/login) appear there."
else
  echo "  pm2 not found in PATH"
fi
echo ""

echo "── 3. Current nginx config (look for login.html as index) ──"
if [[ -d /etc/nginx/sites-enabled ]]; then
  grep -rn "root\|index\|server_name\|login\|signin\|try_files\|rewrite" /etc/nginx/sites-enabled/ 2>/dev/null || echo "  (no matches)"
else
  echo "  nginx sites-enabled not found"
fi
echo ""

echo "── 4. What nginx returns for / (local test) ──"
if command -v curl >/dev/null 2>&1; then
  echo "  HTTP / :"
  curl -sI -H "Host: www.selectai.it.com" http://127.0.0.1/ 2>/dev/null | head -8 || echo "  curl failed"
  echo "  HTTPS / (if SSL configured):"
  curl -skI -H "Host: www.selectai.it.com" https://127.0.0.1/ 2>/dev/null | head -8 || echo "  HTTPS not available locally"
  echo "  First bytes of body (should NOT be login welcome page):"
  BODY=$(curl -sk -H "Host: www.selectai.it.com" https://127.0.0.1/ 2>/dev/null | head -5 || true)
  echo "${BODY}" | sed 's/^/    /'
  if echo "${BODY}" | grep -qi "Welcome to SelectAI\|auth-welcome\|Sign In — SelectAI"; then
    echo "  *** PROBLEM: root URL is still serving login/signin content ***"
  elif echo "${BODY}" | grep -qi "Welcome to SelectAI Innovations\|hero-title\|live-metrics"; then
    echo "  OK: root URL appears to serve index.html"
  fi
else
  echo "  curl not installed"
fi
echo ""

echo "── 5. Nginx access log (recent homepage hits) ──"
for log in /var/log/nginx/selectai-access.log /var/log/nginx/access.log; do
  if [[ -f "$log" ]]; then
    echo "  Last 10 lines of ${log}:"
    tail -10 "$log" | sed 's/^/    /'
    break
  fi
done
echo ""

echo "── 6. Applying nginx config from repo ──"
if [[ ! -f "${APP_ROOT}/deploy/nginx-selectai.conf" ]]; then
  echo "  ERROR: ${APP_ROOT}/deploy/nginx-selectai.conf not found."
  echo "  Run: cd ${APP_ROOT} && git pull origin main"
  exit 1
fi

# Check SSL cert paths — fall back to HTTP-only if certs missing
SSL_CERT="/etc/letsencrypt/live/www.selectai.it.com/fullchain.pem"
USE_SSL=true
if [[ ! -f "$SSL_CERT" ]]; then
  echo "  SSL cert not found at ${SSL_CERT}"
  echo "  Writing HTTP-only config (port 80)..."
  USE_SSL=false
  cat > /tmp/selectai-nginx-http.conf <<'NGINX_HTTP'
server {
    listen 80;
    listen [::]:80;
    server_name selectai.com www.selectai.com selectai.it.com www.selectai.it.com;
    root /var/www/SelectAI;
    index index.html;
    access_log /var/log/nginx/selectai-access.log;
    error_log  /var/log/nginx/selectai-error.log;
    location = / { try_files /index.html =404; }
    location / { try_files $uri $uri/ =404; }
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX_HTTP
  cp /tmp/selectai-nginx-http.conf "${NGINX_AVAILABLE}"
else
  cp "${APP_ROOT}/deploy/nginx-selectai.conf" "${NGINX_AVAILABLE}"
fi

ln -sf "${NGINX_AVAILABLE}" "${NGINX_ENABLED}"

# Disable default site if it overrides our config
if [[ -f /etc/nginx/sites-enabled/default ]]; then
  echo "  Disabling nginx default site (often serves wrong index)..."
  rm -f /etc/nginx/sites-enabled/default
fi

nginx -t
systemctl reload nginx
echo "  nginx reloaded."
echo ""

echo "── 7. Verify after fix ──"
if command -v curl >/dev/null 2>&1; then
  PROTO="http"
  [[ "$USE_SSL" == true ]] && PROTO="https"
  curl -skI -H "Host: www.selectai.it.com" "${PROTO}://127.0.0.1/" 2>/dev/null | head -6 || true
fi
echo ""
echo "Done. Open https://www.selectai.it.com in a private/incognito window."
echo "Watch live page hits:  sudo tail -f /var/log/nginx/selectai-access.log"
echo ""
