#!/usr/bin/env bash
set -euo pipefail

# À exécuter depuis un service d’uptime ou une machine hors de l’hébergeur API.
# Si l’API est totalement indisponible, l’outil externe conserve l’alerte ; le
# prochain passage sain envoie la résolution au webhook.
BASE_URL="${ECARNET_EXTERNAL_MONITOR_BASE_URL:-${ECARNET_MONITOR_BASE_URL:-}}"
export ECARNET_MONITOR_BASE_URL="$BASE_URL"
export ECARNET_MONITOR_EVENT_BASE_URL="${ECARNET_EXTERNAL_MONITOR_EVENT_BASE_URL:-$BASE_URL}"
export ECARNET_MONITOR_WEBHOOK_SECRET="${ECARNET_EXTERNAL_MONITOR_WEBHOOK_SECRET:-${ECARNET_MONITOR_WEBHOOK_SECRET:-}}"
export ECARNET_MONITOR_REQUIRE_COMPONENTS=false

if [[ -z "$BASE_URL" || -z "$ECARNET_MONITOR_WEBHOOK_SECRET" ]]; then
  echo "ECARNET_EXTERNAL_MONITOR_BASE_URL et ECARNET_EXTERNAL_MONITOR_WEBHOOK_SECRET sont requis." >&2
  exit 2
fi

# La sonde indépendante ne vérifie volontairement que l’API publique : elle ne
# partage ni le secret applicatif ni les accès base/cache/stockage/SMTP.
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/monitoring-check.sh"
