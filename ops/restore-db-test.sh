#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ $# -ne 1 || ! -f "$1" ]]; then
  echo "Usage : $0 <chemin-vers-une-sauvegarde.dump>" >&2
  exit 2
fi
if ! command -v docker >/dev/null 2>&1; then
  echo "Docker Compose v2 est requis pour tester la restauration." >&2
  exit 1
fi

archive="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
expected_hash="$(sha256sum "$archive" | cut -d ' ' -f 1)"
if [[ -f "$archive.sha256" ]]; then
  (cd "$(dirname "$archive")" && sha256sum --check "$(basename "$archive").sha256")
fi
if ! docker compose ps --status running --services | grep -Fxq db; then
  echo "Le service PostgreSQL 'db' doit être démarré." >&2
  exit 1
fi
docker compose exec -T db pg_restore --list < "$archive" >/dev/null

read -r db_user db_name < <(docker compose exec -T db sh -euc 'printf "%s %s\n" "$POSTGRES_USER" "$POSTGRES_DB"')
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
restore_db="${db_name}_restore_${stamp}"
if [[ ! "$restore_db" =~ ^[A-Za-z0-9_]+$ ]]; then
  echo "Nom de base généré non sûr; restauration annulée." >&2
  exit 1
fi

started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
started_epoch="$(date +%s)"
docker compose exec -T db createdb --username "$db_user" "$restore_db"
if ! docker compose exec -T db pg_restore --exit-on-error --no-owner --no-privileges --username "$db_user" --dbname "$restore_db" < "$archive"; then
  echo "Restauration échouée. La base isolée '$restore_db' est conservée pour diagnostic; la base source n’a pas été modifiée." >&2
  exit 1
fi
migration_count="$(docker compose exec -T db psql -X -v ON_ERROR_STOP=1 -At --username "$db_user" --dbname "$restore_db" -c 'SELECT count(*) FROM django_migrations;')"
if [[ ! "$migration_count" =~ ^[0-9]+$ ]] || (( migration_count == 0 )); then
  echo "Contrôle post-restauration échoué : table django_migrations absente ou vide." >&2
  exit 1
fi
finished_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
duration_seconds="$(( $(date +%s) - started_epoch ))"
report="${archive}.restore-${stamp}.txt"
umask 077
cat > "$report" <<EOF
source_archive=$archive
archive_sha256=$expected_hash
started_at_utc=$started_at
finished_at_utc=$finished_at
restore_command_duration_seconds=$duration_seconds
rpo_seconds=NON_CALCULE_REQUIERT_SENTINEL_METIER
restored_database=$restore_db
migration_rows=$migration_count
source_database_modified=no
EOF
chmod 600 "$report"
printf 'Restauration de test réussie dans la base isolée : %s\nDurée de la commande : %s s\nRapport : %s\nLa base source a été conservée. Le RPO métier reste à mesurer avec un marqueur de test convenu.\n' "$restore_db" "$duration_seconds" "$report"
