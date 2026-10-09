#!/usr/bin/env bash
set -euo pipefail

# Test destructif uniquement pour la base de restauration à nom unique ; la base source reste intacte.
# Nécessite DATABASE_URL vers une base de test dédiée, ainsi que pg_dump/pg_restore/createdb/psql.
: "${DATABASE_URL:?Définir DATABASE_URL vers une base PostgreSQL de test dédiée}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPORT_DIR="${REPORT_DIR:-$ROOT_DIR/reports}"
mkdir -p "$REPORT_DIR"
chmod 700 "$REPORT_DIR"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
restore_db="ecarnet_restore_${stamp//[^A-Za-z0-9]/_}"
report="$REPORT_DIR/postgres-restore-$stamp.txt"
archive="$(mktemp "${TMPDIR:-/tmp}/ecarnet-pg-backup.XXXXXX.dump")"
trap 'rm -f "$archive"' EXIT

python3 - "$DATABASE_URL" "$restore_db" <<'PY' > /tmp/ecarnet-pg-restore-urls.$$
import sys
from urllib.parse import urlsplit, urlunsplit
source, dbname = sys.argv[1:]
p = urlsplit(source)
if p.scheme not in ("postgres", "postgresql"):
    raise SystemExit("DATABASE_URL doit être une URL PostgreSQL")
if not p.path.strip("/"):
    raise SystemExit("DATABASE_URL doit contenir le nom de la base source")
def for_db(name):
    path = "/" + name
    if not p.netloc:
        return p.scheme + "://" + path + (("?" + p.query) if p.query else "")
    return urlunsplit((p.scheme, p.netloc, path, p.query, p.fragment))
print(for_db("postgres"))
print(for_db(dbname))
PY
mapfile -t urls < /tmp/ecarnet-pg-restore-urls.$$
rm -f /tmp/ecarnet-pg-restore-urls.$$
maintenance_url="${urls[0]}"
restore_url="${urls[1]}"

started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
started_epoch="$(date +%s)"
marker="smoke-$stamp"
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -v marker="$marker" -c 'CREATE TABLE IF NOT EXISTS backup_restore_probe (marker text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now());' >/dev/null
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -c "INSERT INTO backup_restore_probe(marker) VALUES ('$marker') ON CONFLICT DO NOTHING;" >/dev/null

pg_dump --format=custom --no-owner --no-privileges --dbname "$DATABASE_URL" > "$archive"
test -s "$archive"
sha256="$(sha256sum "$archive" | cut -d ' ' -f 1)"
pg_restore --list "$archive" >/dev/null
createdb --maintenance-db="$maintenance_url" "$restore_db"
pg_restore --exit-on-error --no-owner --no-privileges --dbname="$restore_url" "$archive"
probe_count="$(psql "$restore_url" -X -v ON_ERROR_STOP=1 -At -c "SELECT count(*) FROM backup_restore_probe WHERE marker = '$marker';")"
migration_count="$(psql "$restore_url" -X -v ON_ERROR_STOP=1 -At -c 'SELECT count(*) FROM django_migrations;')"
[[ "$probe_count" == "1" ]]
[[ "$migration_count" =~ ^[0-9]+$ && "$migration_count" -gt 0 ]]
finished_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
duration="$(( $(date +%s) - started_epoch ))"
cat > "$report" <<EOF
started_at_utc=$started_at
finished_at_utc=$finished_at
source_database_name=$(python3 -c 'import sys; from urllib.parse import urlsplit; print(urlsplit(sys.argv[1]).path.lstrip("/"))' "$DATABASE_URL")
restored_database=$restore_db
archive_format=postgres-custom
archive_bytes=$(wc -c < "$archive" | tr -d ' ')
archive_sha256=$sha256
pg_restore_list=passed
restore_exit_on_error=passed
marker_restored=$probe_count
migration_rows_restored=$migration_count
restore_elapsed_seconds=$duration
source_database_modified_by_restore=no
rpo=not_measured_requires_external_scheduled_backup_and_failure_marker
rto=local_restore_command_duration_only_not_service_recovery
EOF
chmod 600 "$report"
printf 'Restauration PostgreSQL isolée réussie. Rapport : %s\nBase de test restaurée : %s\nEmpreinte SHA-256 : %s\n' "$report" "$restore_db" "$sha256"
