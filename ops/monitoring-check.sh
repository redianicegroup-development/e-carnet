#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${ECARNET_MONITOR_BASE_URL:-}"
WEBHOOK_URL="${ECARNET_MONITOR_WEBHOOK_URL:-}"
TIMEOUT_SECONDS="${ECARNET_MONITOR_TIMEOUT_SECONDS:-8}"

if [[ -z "$BASE_URL" ]]; then
  echo "ECARNET_MONITOR_BASE_URL est requis (ex. https://api.example.tld)." >&2
  exit 2
fi
if ! command -v curl >/dev/null 2>&1; then
  echo "curl est requis pour exécuter la surveillance." >&2
  exit 2
fi

BASE_URL="${BASE_URL%/}"
failed=0
check_probe() {
  local name="$1" path="$2" code
  if code="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' --max-time "$TIMEOUT_SECONDS" "$BASE_URL$path" 2>/dev/null)" && [[ "$code" =~ ^2[0-9][0-9]$ ]]; then
    printf '%s PASS http=%s\n' "$name" "$code"
  else
    printf '%s FAIL http=%s\n' "$name" "${code:-no-response}"
    failed=1
  fi
}

printf 'checked_at_utc=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
check_probe liveness /api/v1/health/live/
check_probe readiness /api/v1/health/ready/

if (( failed != 0 )); then
  if [[ -n "$WEBHOOK_URL" ]]; then
    payload='{"text":"Mon E-Carnet : échec de la sonde liveness/readiness. Consulter le tableau de bord d’exploitation."}'
    if ! curl --silent --show-error --fail --max-time "$TIMEOUT_SECONDS" -H 'Content-Type: application/json' -d "$payload" "$WEBHOOK_URL" >/dev/null; then
      echo "alerte_webhook=FAIL"
    else
      echo "alerte_webhook=sent"
    fi
  else
    echo "alerte_webhook=not-configured"
  fi
  exit 1
fi

echo "monitoring=PASS"
