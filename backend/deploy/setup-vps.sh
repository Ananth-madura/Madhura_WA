#!/usr/bin/env bash
# =============================================================================
#  setup-vps.sh — ONE-TIME bootstrap for the Hostinger VPS
#
#  Run as the app user (not root), or with sudo, on a fresh VPS:
#      bash deploy/setup-vps.sh
#
#  Idempotent: safe to re-run. It installs only what is missing.
#
#  What it does NOT do, on purpose:
#   - it does not create the database (that needs the Hostinger password, and
#     first-boot-db.js handles schema creation once the password is known)
#   - it does not touch your .env (you fill that in by hand from
#     .env.production.example, because it contains secrets)
#   - it does not install a certificate (certbot is interactive)
# =============================================================================

set -euo pipefail

APP_DIR="${APP_DIR:-/home/wauser/app/backend}"
WA_DATA_DIR="${WA_DATA_DIR:-/home/wauser/wa-data}"
API_DOMAIN="${API_DOMAIN:-api.madhuratech.in}"
DB_NAME="${DB_NAME:-madhura_wa}"

log()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok()   { printf '    \033[32mOK\033[0m  %s\n' "$*"; }
warn() { printf '    \033[33mWARN\033[0m %s\n' "$*"; }
die()  { printf '\n\033[1;31mFAILED: %s\033[0m\n\n' "$*" >&2; exit 1; }

SUDO=""
[ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null && SUDO="sudo"

# -----------------------------------------------------------------------------
log "System packages"
# -----------------------------------------------------------------------------
$SUDO apt-get update -qq
for pkg in git curl build-essential python3 nginx redis-server; do
  if dpkg -s "$pkg" >/dev/null 2>&1; then
    ok "$pkg installed"
  else
    $SUDO apt-get install -y -qq "$pkg" && ok "$pkg installed"
  fi
done

# Chromium's shared libraries. whatsapp-web.js launches a real browser for QR
# pairing; without these it dies with an unhelpful missing-libc error.
log "Chromium runtime libraries"
$SUDO apt-get install -y -qq \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
  libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 \
  libpango-1.0-0 libcairo2 fonts-liberation xdg-utils || \
  warn "Some Chromium libraries failed to install — QR pairing may fail. Check with: ldd \$CHROME | grep 'not found'"

# -----------------------------------------------------------------------------
log "Node.js 24 LTS"
# -----------------------------------------------------------------------------
if command -v node >/dev/null && [ "$(node -v | cut -d. -f1 | cut -d v -f2)" -eq 24 ]; then
  ok "Node $(node -v) already present"
else
  curl -fsSL https://deb.nodesource.com/setup_24.x | $SUDO -E bash -
  $SUDO apt-get install -y -qq nodejs
  ok "Node $(node -v) installed"
fi

# -----------------------------------------------------------------------------
log "PM2 + log rotation"
# -----------------------------------------------------------------------------
command -v pm2 >/dev/null || { $SUDO npm i -g pm2; ok "pm2 installed"; }
$SUDO npm i -g pm2-logrotate
pm2 set pm2-logrotate:max_size 20M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
ok "pm2 $(pm2 -v | awk '{print $NF}') with log rotation (20M x 7)"

# -----------------------------------------------------------------------------
log "Redis (WhatsApp message queue)"
# -----------------------------------------------------------------------------
if systemctl is-active --quiet redis-server; then
  ok "redis-server running"
else
  $SUDO systemctl enable --now redis-server
  ok "redis-server started"
fi
redis-cli ping 2>/dev/null | grep -q PONG && ok "Redis responding" || warn "Redis not responding — the backend will fall back to synchronous sends"

# -----------------------------------------------------------------------------
log "Swap (Chromium is memory-hungry)"
# -----------------------------------------------------------------------------
# A 2GB VPS will OOM-kill Chromium during a session restore without swap.
if swapon --show | grep -q .; then
  ok "swap already configured"
elif free -m | awk '/^Mem:/{print $2}' | grep -qE '^[0-9]{4,}$'; then
  ok "Enough RAM, skipping swap"
else
  warn "Low RAM and no swap. Add 2G swap before going live:"
  warn "  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile"
  warn "  sudo mkswap /swapfile && sudo swapon /swapfile"
  warn "  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab"
fi

# -----------------------------------------------------------------------------
log "Directories"
# -----------------------------------------------------------------------------
mkdir -p "$WA_DATA_DIR"/{uploads/wa-media,whatsapp-sessions,logs,backups,.cache/puppeteer}
mkdir -p "$APP_DIR"
chmod -R 750 "$WA_DATA_DIR"
# Sessions hold a live WhatsApp login. 700, owned by the app user.
chmod -R 700 "$WA_DATA_DIR/whatsapp-sessions"
ok "State under $WA_DATA_DIR (outside $APP_DIR — deploys cannot touch it)"

# -----------------------------------------------------------------------------
log "Ulimits"
# -----------------------------------------------------------------------------
# Chromium needs a high open-file ceiling to run several WhatsApp sessions.
if ! grep -q "wauser soft nofile" /etc/security/limits.conf 2>/dev/null; then
  echo "wauser soft nofile 65536" | $SUDO tee -a /etc/security/limits.conf >/dev/null
  echo "wauser hard nofile 65536" | $SUDO tee -a /etc/security/limits.conf >/dev/null
  ok "nofile limit raised to 65536"
fi

# -----------------------------------------------------------------------------
log "Database"
# -----------------------------------------------------------------------------
if command -v mysql >/dev/null; then
  ok "mysql client present"
else
  $SUDO apt-get install -y -qq default-mysql-client
  ok "mysql client installed"
fi
warn "Create the database manually (Hostinger password required):"
warn "  CREATE DATABASE $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
warn "  Then put DB_HOST / DB_USER / DB_PASS / DB_NAME into $APP_DIR/.env"
warn "  On Hostinger the DB host is usually 'localhost' via socket. If that"
warn "  fails, it is in the hPanel MySQL > Databases section."

# -----------------------------------------------------------------------------
log "nginx"
# -----------------------------------------------------------------------------
if [ -f "$APP_DIR/deploy/nginx/whatsapp-crm.conf" ]; then
  $SUDO cp "$APP_DIR/deploy/nginx/whatsapp-crm.conf" /etc/nginx/sites-available/whatsapp-crm
  $SUDO ln -sf /etc/nginx/sites-available/whatsapp-crm /etc/nginx/sites-enabled/whatsapp-crm
  $SUDO rm -f /etc/nginx/sites-enabled/default
  $SUDO nginx -t && $SUDO systemctl reload nginx && ok "site config installed"
else
  warn "deploy/nginx/whatsapp-crm.conf not found at $APP_DIR"
  warn "Upload it manually, or copy it after the first git clone."
fi

warn "Point $API_DOMAIN at this server's IP FIRST, then issue the certificate:"
warn "  $SUDO certbot --nginx -d $API_DOMAIN"
warn "  (DNS must have propagated or certbot fails the HTTP-01 challenge)"

# -----------------------------------------------------------------------------
log "Firewall"
# -----------------------------------------------------------------------------
$SUDO ufw allow OpenSSH 2>/dev/null || true
$SUDO ufw allow 'Nginx Full' 2>/dev/null || true
$SUDO ufw --force enable 2>/dev/null && ok "ufw: only SSH + HTTP/HTTPS open" || warn "ufw not available (common inside VPS containers)"

# -----------------------------------------------------------------------------
cat <<EOF

$(printf '\033[1;32m')\n  Bootstrap complete. Remaining manual steps:\n$(printf '\033[0m')

  1. Point DNS:      $API_DOMAIN  ->  this server's IPv4
  2. Get the cert:   $SUDO certbot --nginx -d $API_DOMAIN
  3. Write .env:     cp .env.production.example .env
                     nano .env        # DB_*, JWT_SECRET, ALLOWED_ORIGINS, PUBLIC_BASE_URL
  4. First deploy:   ./deploy/deploy.sh
  5. Point the frontend at the backend:
                     frontend/.env.production  -> REACT_APP_SOCKET_URL=https://$API_DOMAIN
                     frontend/vercel.json      -> api.example.com -> $API_DOMAIN
                     Set the same value as REACT_APP_SOCKET_URL in the Vercel dashboard.

  Then verify the whole chain from the frontend folder:
     VERIFY_SITE_URL=https://app.example.com \\
     VERIFY_API_URL=https://$API_DOMAIN \\
     npm run verify:api

EOF
