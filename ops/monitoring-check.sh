#!/usr/bin/env bash
set -euo pipefail

# Sonde exécutée sur le serveur applicatif. Les contrôles locaux sont activés en
# staging/production avec ECARNET_MONITOR_REQUIRE_COMPONENTS=true. Aucun secret
# n'est affiché et aucun contenu médical n'est envoyé au webhook.
BASE_URL="${ECARNET_MONITOR_BASE_URL:-}"
EVENT_BASE_URL="${ECARNET_MONITOR_EVENT_BASE_URL:-$BASE_URL}"
SECRET="${ECARNET_MONITOR_WEBHOOK_SECRET:-}"
TIMEOUT_SECONDS="${ECARNET_MONITOR_TIMEOUT_SECONDS:-8}"
REQUIRE_COMPONENTS="${ECARNET_MONITOR_REQUIRE_COMPONENTS:-false}"
SENDER="${ECARNET_MONITOR_SENDER:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/send-monitoring-event.py}"

if [[ -z "$BASE_URL" ]]; then
  echo "ECARNET_MONITOR_BASE_URL est requis (ex. https://api.example.tld)." >&2
  exit 2
fi
if ! command -v curl >/dev/null 2>&1; then
  echo "curl est requis pour exécuter la surveillance." >&2
  exit 2
fi
if [[ "$REQUIRE_COMPONENTS" == "true" && -z "$SECRET" ]]; then
  echo "ECARNET_MONITOR_WEBHOOK_SECRET est requis lorsque les contrôles sont obligatoires." >&2
  exit 2
fi

BASE_URL="${BASE_URL%/}"
EVENT_BASE_URL="${EVENT_BASE_URL%/}"
failed=0

send_event() {
  local key="$1" action="$2" category="$3" severity="$4" summary="$5"
  [[ -n "$SECRET" ]] || return 0
  if ! ECARNET_MONITOR_WEBHOOK_SECRET="$SECRET" python3 "$SENDER" "$key" "$action" \
      --base-url "$EVENT_BASE_URL" --category "$category" --severity "$severity" \
      --summary "$summary" >/dev/null; then
    echo "event=$key action=$action FAIL" >&2
  else
    echo "event=$key action=$action sent"
  fi
}

report() {
  local key="$1" category="$2" label="$3" result="$4" summary="$5" severity="${6:-major}"
  if [[ "$result" == "PASS" ]]; then
    printf '%s PASS %s\n' "$label" "$summary"
    send_event "$key" resolve "$category" "$severity" "$summary"
  else
    printf '%s FAIL %s\n' "$label" "$summary"
    failed=1
    send_event "$key" open "$category" "$severity" "$summary"
  fi
}

check_http() {
  local label="$1" path="$2" key="$3" category="$4" code=""
  if code="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' --max-time "$TIMEOUT_SECONDS" "$BASE_URL$path" 2>/dev/null)" && [[ "$code" =~ ^2[0-9][0-9]$ ]]; then
    report "$key" "$category" "$label" PASS "http=$code" critical
  else
    report "$key" "$category" "$label" FAIL "http=${code:-no-response}" critical
  fi
}

check_tcp() {
  local label="$1" host="$2" port="$3" key="$4" category="$5"
  if [[ -z "$host" || -z "$port" ]]; then
    if [[ "$REQUIRE_COMPONENTS" == "true" ]]; then
      report "$key" "$category" "$label" FAIL "configuration manquante" major
    else
      printf '%s SKIP configuration absente\n' "$label"
    fi
    return
  fi
  if timeout "$TIMEOUT_SECONDS" bash -c "</dev/tcp/$host/$port" 2>/dev/null; then
    report "$key" "$category" "$label" PASS "tcp=$host:$port" major
  else
    report "$key" "$category" "$label" FAIL "tcp indisponible" major
  fi
}

check_storage() {
  local path="${ECARNET_MONITOR_STORAGE_PATH:-}" key="storage:write" category=storage
  if [[ -z "$path" ]]; then
    if [[ "$REQUIRE_COMPONENTS" == "true" ]]; then report "$key" "$category" stockage FAIL "configuration manquante" major; else echo "stockage SKIP configuration absente"; fi
  elif [[ -d "$path" && -w "$path" ]]; then
    report "$key" "$category" stockage PASS "répertoire accessible" major
  else
    report "$key" "$category" stockage FAIL "répertoire inaccessible" major
  fi
}

check_backup() {
  local dir="${ECARNET_MONITOR_BACKUP_DIR:-}" max_age="${ECARNET_MONITOR_BACKUP_MAX_AGE_SECONDS:-90000}" newest age now
  if [[ -z "$dir" ]]; then
    if [[ "$REQUIRE_COMPONENTS" == "true" ]]; then report "backup:last-success" backup sauvegarde FAIL "configuration manquante" major; else echo "sauvegarde SKIP configuration absente"; fi
    return
  fi
  newest="$(find "$dir" -maxdepth 1 -type f ! -name '*.sha256' ! -name '*.metadata' -printf '%T@\n' 2>/dev/null | sort -nr | head -n1 || true)"
  now="$(date +%s)"
  if [[ -n "$newest" ]]; then age="$((now - ${newest%.*}))"; else age=9999999999; fi
  if (( age <= max_age )); then report "backup:last-success" backup sauvegarde PASS "age_seconds=$age" major; else report "backup:last-success" backup sauvegarde FAIL "age_seconds=$age" major; fi
}

printf 'checked_at_utc=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
check_http liveness /api/v1/health/live/ api:liveness-down api
check_http readiness /api/v1/health/ready/ api:readiness-down api
check_tcp database "${ECARNET_MONITOR_DATABASE_HOST:-}" "${ECARNET_MONITOR_DATABASE_PORT:-5432}" database:unreachable database
check_tcp cache "${ECARNET_MONITOR_CACHE_HOST:-}" "${ECARNET_MONITOR_CACHE_PORT:-6379}" cache:unreachable cache
check_storage
check_backup
check_tcp smtp "${ECARNET_MONITOR_SMTP_HOST:-}" "${ECARNET_MONITOR_SMTP_PORT:-587}" email:unreachable email

if (( failed != 0 )); then
  echo "monitoring=FAIL"
  exit 1
fi
echo "monitoring=PASS"
