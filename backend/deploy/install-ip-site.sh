#!/usr/bin/env bash
# =============================================================================
#  install-ip-site.sh — serve the CRM on the bare VPS IP, no domain involved.
#
#      cd /home/wauser/app/backend
#      sudo bash deploy/install-ip-site.sh
#
#  Result:  http://187.127.215.13/          -> the workspace (frontend build)
#           http://187.127.215.13/health    -> the API, proxied to :5001
#           http://187.127.215.13/api/...   -> the API, same origin, no CORS
#
#  DNS, certificates and port 5001 are not involved. Port 5001 stays closed;
#  Nginx on 80 is the only public door.
#
#  Overridable:
#      IP_ADDRESS=187.127.215.13
#      API_PORT=5001
#      FRONTEND_ROOT=/home/wauser/app/frontend/build
#      SITE_NAME=wa-crm-ip
#      ACTION=install|remove
#
#  Plain HTTP means credentials cross the network unencrypted. Use this for
#  field/office access on a trusted network, or put a TLS terminator in front
#  once DNS exists. Do not treat http://<ip>/ as a public-internet login page.
# =============================================================================
set -euo pipefail

IP_ADDRESS="${IP_ADDRESS:-187.127.215.13}"
API_PORT="${API_PORT:-5001}"
FRONTEND_ROOT="${FRONTEND_ROOT:-/home/wauser/app/frontend/build}"
SITE_NAME="${SITE_NAME:-wa-crm-ip}"
ACTION="${ACTION:-install}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CONF_SRC="$SCRIPT_DIR/nginx-ip.conf"

SUDO=()
if [ "$(id -u)" -ne 0 ]; then SUDO=(sudo); fi

log()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok()   { printf '    \033[32mOK\033[0m  %s\n' "$*"; }
warn() { printf '    \033[33mWARN\033[0m %s\n' "$*"; }
die()  { printf '\n\033[1;31mFAILED: %s\033[0m\n\n' "$*" >&2; exit 1; }

[[ "$IP_ADDRESS" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]] || die "IP_ADDRESS '$IP_ADDRESS' is not an IPv4 address"
[[ "$API_PORT" =~ ^[0-9]+$ ]] || die "API_PORT '$API_PORT' is not a port number"
command -v nginx >/dev/null || die "nginx is not installed on this host"

if [ -d /etc/nginx/sites-available ] && [ -d /etc/nginx/sites-enabled ]; then
  MODE="site"
  CONF_DEST="/etc/nginx/sites-available/$SITE_NAME.conf"
  CONF_LINK="/etc/nginx/sites-enabled/$SITE_NAME.conf"
else
  MODE="confd"
  CONF_DEST="/etc/nginx/conf.d/$SITE_NAME.conf"
  CONF_LINK=""
fi

remove_site() {
  log "Removing $SITE_NAME"
  "${SUDO[@]}" rm -f "$CONF_DEST" ${CONF_LINK:+"$CONF_LINK"}
  "${SUDO[@]}" nginx -t
  "${SUDO[@]}" systemctl reload nginx
  ok "Removed. http://$IP_ADDRESS/ is no longer served by this project."
}

if [ "$ACTION" = "remove" ]; then
  remove_site
  exit 0
fi

# -----------------------------------------------------------------------------
log "Preflight"
# -----------------------------------------------------------------------------
[ -f "$CONF_SRC" ] || die "Missing $CONF_SRC (run this from the backend checkout)"

if [ -f "$FRONTEND_ROOT/index.html" ]; then
  ok "Frontend build found at $FRONTEND_ROOT"
else
  warn "No index.html at $FRONTEND_ROOT. /api and /health will work; / will 404."
  warn "Build it first, from the frontend checkout:"
  warn "  cd /home/wauser/app/frontend && npm ci && npm run build"
  warn "The build needs no environment variables: a page loaded from the IP"
  warn "resolves the API to its own origin."
fi

# A second server block claiming the same server_name makes nginx warn and the
# winner unpredictable. Report it instead of silently losing the request.
CLAIMED_BY="$(grep -rl --include='*.conf' -E "server_name[^;]*\b${IP_ADDRESS//./\\.}\b" \
  /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null | grep -v "$SITE_NAME" || true)"
if [ -n "$CLAIMED_BY" ]; then
  warn "Another vhost also claims $IP_ADDRESS:"
  echo "$CLAIMED_BY" | sed 's/^/           /'
  warn "If http://$IP_ADDRESS/ still lands elsewhere, remove server_name for the IP from that file."
fi

# -----------------------------------------------------------------------------
log "Render and install"
# -----------------------------------------------------------------------------
RENDERED="$(mktemp)"
trap 'rm -f "$RENDERED"' EXIT

sed \
  -e "s#server_name 187\.127\.215\.13;#server_name $IP_ADDRESS;#" \
  -e "s#root /home/wauser/app/frontend/build;#root $FRONTEND_ROOT;#" \
  -e "s#127\.0\.0\.1:5001#127.0.0.1:$API_PORT#g" \
  "$CONF_SRC" > "$RENDERED"

grep -q "server_name $IP_ADDRESS;" "$RENDERED" \
  || die "The template no longer contains 'server_name 187.127.215.13;' — update nginx-ip.conf or this script."
grep -q "root $FRONTEND_ROOT;" "$RENDERED" \
  || die "The template no longer contains the default root line — update nginx-ip.conf or this script."
grep -q "127.0.0.1:$API_PORT" "$RENDERED" \
  || die "The template no longer contains the default upstream — update nginx-ip.conf or this script."
ok "Rendered for $IP_ADDRESS -> 127.0.0.1:$API_PORT, root $FRONTEND_ROOT"

"${SUDO[@]}" mkdir -p "$(dirname "$CONF_DEST")"
"${SUDO[@]}" install -m 644 "$RENDERED" "$CONF_DEST"
if [ -n "$CONF_LINK" ]; then
  "${SUDO[@]}" ln -sfn "$CONF_DEST" "$CONF_LINK"
fi

if "${SUDO[@]}" nginx -t; then
  "${SUDO[@]}" systemctl reload nginx
  ok "nginx reloaded"
else
  warn "nginx rejected the config; reverting so the server keeps serving."
  "${SUDO[@]}" rm -f "$CONF_DEST" ${CONF_LINK:+"$CONF_LINK"}
  "${SUDO[@]}" nginx -t || true
  die "Configuration rejected. Nothing was enabled."
fi

# -----------------------------------------------------------------------------
log "Verify from this host"
# -----------------------------------------------------------------------------
CODE_ROOT="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "http://$IP_ADDRESS/" 2>/dev/null || echo 000)"
CODE_HEALTH="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "http://$IP_ADDRESS/health" 2>/dev/null || echo 000)"

if [ "$CODE_ROOT" = "200" ]; then
  ok "http://$IP_ADDRESS/ -> 200 (workspace served)"
else
  warn "http://$IP_ADDRESS/ -> HTTP $CODE_ROOT (frontend build missing or the vhost lost the request)"
fi

if [ "$CODE_HEALTH" = "200" ]; then
  ok "http://$IP_ADDRESS/health -> 200 (API reachable through port 80)"
elif [ "$CODE_HEALTH" = "502" ]; then
  warn "http://$IP_ADDRESS/health -> 502: Nginx is fine, the Node process on :$API_PORT is not running."
  warn "  Fix the process first:  bash deploy/diagnose-api.sh   (or FIX=1 bash deploy/diagnose-api.sh)"
else
  warn "http://$IP_ADDRESS/health -> HTTP $CODE_HEALTH"
fi

if grep -qE '^AUTH_COOKIE_SECURE=(0|false|off|no)$' "$APP_DIR/.env" 2>/dev/null; then
  ok "AUTH_COOKIE_SECURE is off in .env: browser sessions work over plain HTTP."
else
  warn "Set AUTH_COOKIE_SECURE=0 in $APP_DIR/.env, then: pm2 restart wa-crm-backend --update-env"
  warn "  Without it, NODE_ENV=production marks the session cookies Secure, the browser"
  warn "  drops them on http://, and every request after login looks unauthenticated."
fi

ORIGIN_LINE="$(grep -E '^ALLOWED_ORIGINS=' "$APP_DIR/.env" 2>/dev/null || true)"
if [ -z "$ORIGIN_LINE" ]; then
  ok "ALLOWED_ORIGINS is not set; the built-in default already lists http://$IP_ADDRESS."
else
  case ",${ORIGIN_LINE#ALLOWED_ORIGINS=}," in
    *"http://$IP_ADDRESS,"*) ok "ALLOWED_ORIGINS lists http://$IP_ADDRESS" ;;
    *) warn "Add http://$IP_ADDRESS to ALLOWED_ORIGINS in $APP_DIR/.env, then restart PM2."
       warn "  Same-origin POSTs still send an Origin header, so the login would be 403 without it." ;;
  esac
fi

cat <<EOF

    Open        http://$IP_ADDRESS/
    API         http://$IP_ADDRESS/api
    Health      http://$IP_ADDRESS/health

    Port $API_PORT stays closed to the internet; Nginx on 80 proxies to it.
    Keep it that way — do not open $API_PORT to "fix" the login.

    Credentials over plain HTTP are not encrypted. Use this on a trusted
    network, or terminate TLS in front of it once DNS exists.

    Remove this site:   ACTION=remove sudo bash deploy/install-ip-site.sh

EOF
