#!/usr/bin/env bash
set -euo pipefail

# Run on a VPS whose Nginx configuration is managed directly, not by CloudPanel.
API_DOMAIN="${API_DOMAIN:-api.madhuratech.in}"
EMAIL="${1:-}"
[[ "$API_DOMAIN" =~ ^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$ ]] || { echo 'Invalid API_DOMAIN' >&2; exit 1; }
[[ "$EMAIL" == *@*.* ]] || { echo 'Usage: bash deploy/repair-api-https.sh your-certificate-contact-email' >&2; exit 1; }
command -v certbot >/dev/null || { echo 'Install certbot and python3-certbot-nginx first, or issue the certificate through your hosting panel.' >&2; exit 1; }

SUDO=()
if [ "$(id -u)" -ne 0 ]; then SUDO=(sudo); fi
"${SUDO[@]}" nginx -t
"${SUDO[@]}" certbot --nginx --non-interactive --agree-tos --email "$EMAIL" --cert-name "$API_DOMAIN" -d "$API_DOMAIN" --redirect --keep-until-expiring
"${SUDO[@]}" nginx -t
"${SUDO[@]}" systemctl reload nginx
"${SUDO[@]}" certbot renew --dry-run
curl --fail --silent --show-error --max-time 15 "https://$API_DOMAIN/health"
printf '\nCertificate and HTTPS health checked. Run npm run verify:production from the repository to check all frontend origins.\n'
