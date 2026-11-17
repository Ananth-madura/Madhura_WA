#!/usr/bin/env bash
# =============================================================================
#  diagnose-api.sh — why does https://api.madhuratech.in answer 502?
#
#  Run on the VPS, from the backend checkout:
#
#      cd /home/wauser/app/backend
#      bash deploy/diagnose-api.sh          # read-only report, changes nothing
#      FIX=1 bash deploy/diagnose-api.sh    # restart the backend, reload nginx
#
#  502 from Nginx means one thing: Nginx is running but the upstream on
#  127.0.0.1:5001 is not answering. This script proves that in order —
#  process, port, local health, database, Nginx upstream — and prints the
#  single next command for whichever check failed.
#
#  It never touches WhatsApp sessions, uploads or the database. The only side
#  effect is pm2 process state, and only when FIX=1.
# =============================================================================
set -uo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
PM2_NAME="${PM2_NAME:-wa-crm-backend}"
API_PORT="${API_PORT:-5001}"
API_DOMAIN="${API_DOMAIN:-api.madhuratech.in}"
WA_DATA_DIR="${WA_DATA_DIR:-/home/wauser/wa-data}"
FIX="${FIX:-0}"

SUDO=()
if [ "$(id -u)" -ne 0 ]; then SUDO=(sudo); fi

section() { printf '\n\033[1;36m== %s\033[0m\n' "$*"; }
note()    { printf '   %s\n' "$*"; }
okay()    { printf '   \033[32mOK\033[0m %s\n' "$*"; }
flag()    { printf '   \033[33m!  %s\033[0m\n' "$*"; }

FAILURES=()
fail() { FAILURES+=("$*"); }

# -----------------------------------------------------------------------------
section "Host"
note "user=$(id -un)  host=$(hostname)  app=$APP_DIR"
note "uptime $(uptime -p 2>/dev/null || uptime)"
free -m 2>/dev/null | awk 'NR==1 || NR==2'
df -h / 2>/dev/null | awk 'NR<=2'
if [ "$(df -P / | awk 'NR==2 {gsub("%","",$5); print $5}')" -ge 95 ] 2>/dev/null; then
  fail "Disk is at or above 95%: MySQL writes fail first, then the API crash-loops."
fi

# -----------------------------------------------------------------------------
section "PM2 process ($PM2_NAME)"
PM2_ONLINE=0
if command -v pm2 >/dev/null 2>&1; then
  PM2_DESCRIBE="$(pm2 describe "$PM2_NAME" 2>/dev/null || true)"
  if [ -z "$PM2_DESCRIBE" ]; then
    flag "PM2 has no process named $PM2_NAME — it was never started, or it was deleted."
    fail "PM2 process $PM2_NAME does not exist."
  else
    echo "$PM2_DESCRIBE" | grep -E 'status|restarts|uptime|script path|exec cwd|exec mode' | sed 's/^/   /'
    if echo "$PM2_DESCRIBE" | grep -qE 'status[^a-zA-Z]+online'; then
      PM2_ONLINE=1
      okay "PM2 reports the process online."
    else
      fail "PM2 process $PM2_NAME is not online (errored / stopped / restarting)."
    fi
  fi
else
  flag "pm2 is not on PATH for $(id -un)."
  fail "pm2 is not installed for this user, so nothing runs the API."
fi

# -----------------------------------------------------------------------------
section "Listener on 127.0.0.1:$API_PORT"
PORT_LINES="$(ss -ltnH 2>/dev/null | grep -E "[:.]$API_PORT([[:space:]]|$)" || true)"
if [ -n "$PORT_LINES" ]; then
  echo "$PORT_LINES" | sed 's/^/   /'
  okay "Something is listening on :$API_PORT."
else
  flag "Nothing is listening on :$API_PORT."
  fail "No listener on :$API_PORT — this is exactly what makes Nginx return 502."
fi

# -----------------------------------------------------------------------------
section "Local health"
LOCAL_HEALTH="$(curl -fsS --max-time 5 "http://127.0.0.1:$API_PORT/health" 2>/dev/null || true)"
if echo "$LOCAL_HEALTH" | grep -q '"ok":true'; then
  okay "http://127.0.0.1:$API_PORT/health -> $LOCAL_HEALTH"
  if ! echo "$LOCAL_HEALTH" | grep -q '"sharedInboxReady":true'; then
    flag "API answers but sharedInboxReady is false: migrations have not finished, so /api/v2 is 503."
  fi
else
  flag "Local /health did not return ok:true. Body: ${LOCAL_HEALTH:-<empty>}"
  fail "The Node process is not serving healthy traffic on :$API_PORT."
fi

# -----------------------------------------------------------------------------
section "Database"
DB_UNIT=""
for unit in mysql mysqld mariadb; do
  if systemctl list-unit-files "${unit}.service" --no-legend 2>/dev/null | grep -q .; then
    DB_UNIT="$unit"
    break
  fi
done
if [ -n "$DB_UNIT" ]; then
  note "$DB_UNIT: $(systemctl is-active "$DB_UNIT" 2>/dev/null)"
  systemctl is-active --quiet "$DB_UNIT" || fail "Database service $DB_UNIT is not active; the API cannot finish boot without it."
else
  flag "No mysql/mariadb unit found. A remote or containerised DB is possible; skipping."
fi

# -----------------------------------------------------------------------------
section "Recent backend log"
if command -v pm2 >/dev/null 2>&1 && [ "$PM2_ONLINE" = "1" ]; then
  pm2 logs "$PM2_NAME" --lines 25 --nostream 2>/dev/null | tail -n 25 | sed 's/^/   /'
else
  tail -n 25 "$WA_DATA_DIR/logs/error.log" 2>/dev/null | sed 's/^/   /' || note "(no $WA_DATA_DIR/logs/error.log)"
fi

# -----------------------------------------------------------------------------
section "Nginx"
NGINX_TEST="$("${SUDO[@]}" nginx -t 2>&1 || true)"
echo "$NGINX_TEST" | sed 's/^/   /'
if echo "$NGINX_TEST" | grep -q 'syntax is ok'; then
  okay "nginx -t: syntax is ok."
else
  fail "nginx -t reported a configuration problem; Nginx is serving a stale or broken vhost."
fi
note "upstream rules pointing at :$API_PORT"
grep -rn "proxy_pass.*$API_PORT" /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null | sed 's/^/   /' \
  || flag "No proxy_pass to :$API_PORT in sites-enabled or conf.d. The vhost may be managed by a hosting panel."
note "nginx: $(systemctl is-active nginx 2>/dev/null || echo unknown)"

# -----------------------------------------------------------------------------
section "Boot persistence"
if systemctl list-unit-files 'pm2-*' --no-legend 2>/dev/null | grep -q .; then
  systemctl list-unit-files 'pm2-*' --no-legend 2>/dev/null | sed 's/^/   /'
  okay "A pm2 systemd unit exists, so the API comes back after a reboot."
else
  flag "No pm2-* systemd unit. After a VPS reboot nothing starts the API and Nginx serves 502 until someone logs in."
  fail "PM2 boot persistence is missing: run 'pm2 startup' then 'pm2 save'."
fi

# -----------------------------------------------------------------------------
section "Public edge"
PUBLIC_CODE="$(curl -k -sS -o /dev/null -w '%{http_code}' --max-time 12 "https://$API_DOMAIN/health" 2>/dev/null || echo 000)"
note "https://$API_DOMAIN/health -> HTTP $PUBLIC_CODE"
if [ "$PUBLIC_CODE" = "200" ]; then
  okay "The public URL reaches a live backend."
else
  fail "The public URL answers HTTP $PUBLIC_CODE (502 means Nginx is up, upstream is down)."
fi

# -----------------------------------------------------------------------------
section "Verdict"
if [ ${#FAILURES[@]} -eq 0 ]; then
  okay "Everything checks out. If the browser still fails, it is CORS or the certificate, not the process."
else
  printf '   %s\n' "The browser message 'enterprise backend service is unreachable' is the client seeing this:"
  for entry in "${FAILURES[@]}"; do flag "$entry"; done
fi

if [ "$FIX" = "1" ]; then
  section "Fix"
  cd "$APP_DIR" || { flag "Cannot cd to $APP_DIR"; exit 1; }
  if [ ! -f .env ]; then
    flag "No .env in $APP_DIR. Copy .env.production.example and fill it in before restarting."
    exit 1
  fi
  if [ ! -d node_modules ]; then
    note "node_modules missing; installing production dependencies."
    PUPPETEER_SKIP_DOWNLOAD=true npm ci --omit=dev || { flag "npm ci failed."; exit 1; }
  fi
  mkdir -p "$WA_DATA_DIR"/{uploads/wa-media,whatsapp-sessions,logs,backups}
  note "Restarting $PM2_NAME with the current environment."
  pm2 startOrRestart ecosystem.config.cjs --update-env && pm2 save

  note "Waiting up to 90s for /health to report ok:true and sharedInboxReady:true."
  HEALTHY=0
  for _ in $(seq 1 90); do
    BODY="$(curl -fsS --max-time 5 "http://127.0.0.1:$API_PORT/health" 2>/dev/null || true)"
    if echo "$BODY" | grep -q '"ok":true' && echo "$BODY" | grep -q '"sharedInboxReady":true'; then
      HEALTHY=1
      okay "Healthy: $BODY"
      break
    fi
    sleep 1
  done
  if [ "$HEALTHY" != "1" ]; then
    flag "Still unhealthy. The last 40 log lines follow; do not reload Nginx yet."
    pm2 logs "$PM2_NAME" --lines 40 --nostream 2>/dev/null | tail -n 40
    tail -n 40 "$WA_DATA_DIR/logs/error.log" 2>/dev/null
    exit 1
  fi

  if "${SUDO[@]}" nginx -t; then
    "${SUDO[@]}" systemctl reload nginx
    okay "Nginx reloaded."
  else
    flag "Nginx config is invalid; not reloading. Nothing about the API changed, so the 502 reason may be the vhost."
    exit 1
  fi

  CODE="$(curl -k -sS -o /dev/null -w '%{http_code}' --max-time 15 "https://$API_DOMAIN/health" 2>/dev/null || echo 000)"
  if [ "$CODE" = "200" ]; then
    okay "https://$API_DOMAIN/health -> HTTP 200. Master admin login should work now."
  else
    flag "Public health still HTTP $CODE. Upstream is healthy, so inspect the vhost Nginx is actually serving:"
    note "grep -rn proxy_pass /etc/nginx/sites-enabled /etc/nginx/conf.d"
  fi
else
  section "Next"
  note "Read-only run. Re-run with repair enabled:"
  note "  FIX=1 bash deploy/diagnose-api.sh"
fi
