#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
report="${1:-$ROOT_DIR/reports/staging-gates-$(date -u +%Y%m%dT%H%M%SZ).txt}"
mkdir -p "$(dirname "$report")"
{
  echo "started_at_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "project=$ROOT_DIR"
  if ! command -v docker >/dev/null 2>&1; then
    echo "postgresql=BLOCKED docker-compose-unavailable"
    echo "restore=BLOCKED docker-compose-unavailable"
    echo "staging=BLOCKED docker-compose-unavailable"
    echo "verdict=NO-GO"
    echo "reason=PostgreSQL, restauration isolée et staging réel non vérifiables dans cet environnement"
    exit 2
  fi
  docker compose config >/dev/null
  echo "compose_config=PASS"
  docker compose up -d db api web
  trap 'docker compose down' EXIT
  for i in $(seq 1 30); do docker compose ps --status running --services | grep -Fxq db && break; sleep 2; done
  docker compose exec -T db pg_isready -U "${POSTGRES_USER:-ecarnet}" -d "${POSTGRES_DB:-ecarnet}"
  echo "postgresql=PASS"
  backup="$ROOT_DIR/backups/gate-$(date -u +%Y%m%dT%H%M%SZ).dump"
  bash ops/backup-db.sh "$backup"
  bash ops/restore-db-test.sh "$backup"
  echo "restore=PASS"
  curl --fail --silent http://127.0.0.1:8000/api/v1/health/ready/ >/dev/null
  curl --fail --silent http://127.0.0.1:3000/manus-routes.json >/dev/null
  echo "staging_smoke=PASS"
  echo "verdict=GO_PENDING_SIGNOFF"
} 2>&1 | tee "$report"
printf 'Rapport : %s\n' "$report"
