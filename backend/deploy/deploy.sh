#!/usr/bin/env bash
# =============================================================================
#  deploy.sh — repeatable zero-surprise deploy for the Whatsapp_CRM backend
#
#  Run on the VPS:
#      cd /home/wauser/app/backend && ./deploy/deploy.sh
#
#  Design rules this script exists to enforce:
#
#   1. The deploy directory is disposable. Runtime state (WhatsApp sessions,
#      uploads, logs, backups) lives in $WA_DATA_DIR, OUTSIDE it. A deploy can
#      therefore never orphan a paired WhatsApp session.
#   2. Take a database dump before migrating. Every migration in this repo
#      touches a table holding customer conversations.
#   3. If the new build does not pass its health check, roll back to the
#      previous commit and restart. Do not leave a half-broken API serving
#      messages.
#   4. This Cloud API deployment does not install or start Chromium.
# =============================================================================

set -euo pipefail
umask 077

APP_DIR="${APP_DIR:-/home/wauser/app/backend}"
WA_DATA_DIR="${WA_DATA_DIR:-/home/wauser/wa-data}"
DB_NAME="${DB_NAME:-madhura_wa}"
MYSQL_BACKUP_LOGIN_PATH="${MYSQL_BACKUP_LOGIN_PATH:-wa-crm-backup}"
SKIP_DB_BACKUP="${SKIP_DB_BACKUP:-0}"

cd "$APP_DIR"

log()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok()   { printf '    \033[32mOK\033[0m  %s\n' "$*"; }
warn() { printf '    \033[33mWARN\033[0m %s\n' "$*"; }
die()  { printf '\n\033[1;31mFAILED: %s\033[0m\n\n' "$*" >&2; exit 1; }

PREV_COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo 'none')"

# -----------------------------------------------------------------------------
log "Preflight"
# -----------------------------------------------------------------------------
[ -f .env ] || die "No .env in $APP_DIR. Copy .env.production.example and fill it in."
node scripts/production-preflight.js || die "Production configuration preflight failed"
WA_DATA_DIR="$(node -e 'require("./scripts/production-preflight").load();process.stdout.write(process.env.WA_DATA_DIR)')"
DB_NAME="$(node -e 'require("./scripts/production-preflight").load();process.stdout.write(process.env.DB_NAME)')"
DB_HOST="$(node -e 'require("./scripts/production-preflight").load();process.stdout.write(process.env.DB_HOST)')"
DB_PORT="$(node -e 'require("./scripts/production-preflight").load();process.stdout.write(process.env.DB_PORT || "3306")')"
git diff --quiet && git diff --cached --quiet || die "Tracked source changes exist; deploy from a clean checkout"

# A placeholder JWT_SECRET means every restart invalidates every login, and in
# production it means anyone can forge a token.
if grep -qE '^JWT_SECRET=(CHANGE_ME|your_|replace)' .env; then
  die "JWT_SECRET is still a placeholder in .env. Generate a real one:
    node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\""
fi

if [ -z "${ALLOWED_ORIGINS:-}" ] && ! grep -qE '^ALLOWED_ORIGINS=.+' .env; then
  warn "ALLOWED_ORIGINS is not set in .env. Cross-origin browser calls will be blocked."
  warn "  Set it to your Vercel domain, e.g. ALLOWED_ORIGINS=https://app.example.com"
fi

mkdir -p "$WA_DATA_DIR"/{uploads/wa-media,whatsapp-sessions,logs,backups,.cache/puppeteer}
chmod -R 750 "$WA_DATA_DIR"

# Sessions are a live WhatsApp login. Do not let a stray chmod expose them.
chmod -R 700 "$WA_DATA_DIR/whatsapp-sessions"
ok "Runtime dirs ready under $WA_DATA_DIR"

command -v pm2 >/dev/null || die "pm2 is not installed. Run: npm i -g pm2"

# -----------------------------------------------------------------------------
if [ "$SKIP_DB_BACKUP" != "1" ]; then
  log "Database backup"
  STAMP="$(date +%Y%m%d-%H%M%S)"
  DUMP="$WA_DATA_DIR/backups/${DB_NAME}-${STAMP}.sql.gz"
  if command -v mysqldump >/dev/null; then
    set +e
    mysqldump --login-path="$MYSQL_BACKUP_LOGIN_PATH" --host="$DB_HOST" --port="$DB_PORT" --single-transaction --quick --no-tablespaces --routines --triggers \
      "$DB_NAME" | gzip -9 > "$DUMP"
    RC=$?
    set -e
    if [ $RC -eq 0 ] && [ -s "$DUMP" ]; then
      # Keep two local pre-deploy dumps; encrypted nightly snapshots live off-server.
      ls -1t "$WA_DATA_DIR"/backups/${DB_NAME}-*.sql.gz 2>/dev/null \
        | tail -n +3 | while IFS= read -r old_dump; do rm -f -- "$old_dump"; done
      ok "Wrote $(basename "$DUMP") ($(du -h "$DUMP" | cut -f1))"
    else
      die "mysqldump failed; no code or schema update was started"
    fi
  else
    die "Install mysqldump and configure the private backup login path before deploying"
  fi
fi

# -----------------------------------------------------------------------------
log "Code"
# -----------------------------------------------------------------------------
git pull --ff-only || die "git pull failed. Resolve the conflict on the server, or deploy from your machine instead."
ok "Now at $(git rev-parse --short HEAD) (was $PREV_COMMIT)"

# -----------------------------------------------------------------------------
log "Dependencies"
# -----------------------------------------------------------------------------
# patch-package runs on postinstall and applies patches/whatsapp-web.js+*.patch.
# That patch is what keeps a paired session from being dropped immediately. If
# the patches/ directory was ever gitignored the postinstall no-ops silently
# (it ends in `|| echo "Patch applied or skipped"`), so verify the result.
PUPPETEER_SKIP_DOWNLOAD=true npm ci --omit=dev || die "npm ci failed"
ok "npm ci complete"

if [ -d patches ] && ls patches/*.patch >/dev/null 2>&1; then
  npx --no-install patch-package --error-on-fail || die "Dependency patch verification failed"
  ok "patches applied: $(ls patches/*.patch | wc -l) file(s)"
else
  warn "No patches/ directory in the deployed copy."
  warn "  If you ignore patches/ in .gitignore, postinstall silently no-ops and"
  warn "  WhatsApp Web sessions drop right after pairing."
fi

# -----------------------------------------------------------------------------
ok "Cloud API-only deployment; Chromium installation skipped"

log "Application"
# -----------------------------------------------------------------------------
export WA_DATA_DIR
export NODE_ENV=production
export PORT=5001

node scripts/production-preflight.js --database || die "Database preflight failed"
# The application applies its reviewed additive migrations before inbox readiness.

pm2 startOrRestart ecosystem.config.cjs --update-env
pm2 save
ok "pm2 restarted"

# -----------------------------------------------------------------------------
log "Health check"
# -----------------------------------------------------------------------------
# Wait for database and inbox migrations, not just an HTTP listener.
HEALTHY=0
for i in $(seq 1 120); do
  BODY="$(curl -fsS --max-time 5 http://127.0.0.1:5001/health 2>/dev/null || true)"
  if echo "$BODY" | grep -q '"ok":true' && echo "$BODY" | grep -q '"sharedInboxReady":true'; then
    HEALTHY=1
    ok "Healthy after ${i}s — $BODY"
    break
  fi
  sleep 1
done

if [ "$HEALTHY" != "1" ]; then
  warn "Health check failed. Recent PM2 output:"
  pm2 logs wa-crm-backend --lines 40 --nostream || true
  if [ "$PREV_COMMIT" != "none" ]; then
    warn "Rolling back to $PREV_COMMIT"
    git checkout --quiet "$PREV_COMMIT"
    pm2 restart ecosystem.config.cjs --update-env || true
    warn "Rolled back. Investigate with: pm2 logs wa-crm-backend"
  fi
  die "Deploy did not become healthy"
fi

# -----------------------------------------------------------------------------
log "Done"
# -----------------------------------------------------------------------------
cat <<EOF

    App     http://127.0.0.1:5001
    Public  https://api.example.com/health

    Check the pair end to end:
      cd $APP_DIR/../frontend
      npm i
      VERIFY_SITE_URL=https://app.example.com \\
      VERIFY_API_URL=https://api.example.com \\
      npm run verify:api

    Useful:
      pm2 logs wa-crm-backend --lines 100
      pm2 status
      tail -f $WA_DATA_DIR/logs/error.log

EOF
