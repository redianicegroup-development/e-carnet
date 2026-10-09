#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker Compose v2 est requis pour créer cette sauvegarde." >&2
  exit 1
fi

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
outfile="${1:-$ROOT_DIR/backups/ecarnet-$stamp.dump}"
if [[ "$outfile" != /* ]]; then
  outfile="$ROOT_DIR/$outfile"
fi
mkdir -p "$(dirname "$outfile")"
chmod 700 "$(dirname "$outfile")"
if [[ -e "$outfile" ]]; then
  echo "Refus d’écraser une sauvegarde existante : $outfile" >&2
  exit 1
fi

if ! docker compose ps --status running --services | grep -Fxq db; then
  echo "Le service PostgreSQL 'db' doit être démarré." >&2
  exit 1
fi

umask 077
docker compose exec -T db sh -euc 'pg_dump --format=custom --no-owner --no-privileges --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"' > "$outfile"
if [[ ! -s "$outfile" ]]; then
  rm -f "$outfile"
  echo "La sauvegarde est vide; elle a été supprimée." >&2
  exit 1
fi

docker compose exec -T db pg_restore --list < "$outfile" >/dev/null
(cd "$(dirname "$outfile")" && sha256sum "$(basename "$outfile")" > "$(basename "$outfile").sha256")
cat > "$outfile.metadata" <<EOF
snapshot_at_utc=$stamp
format=postgres-custom
sha256=$(cut -d ' ' -f 1 "$outfile.sha256")
source=local-docker-compose-db
EOF
chmod 600 "$outfile" "$outfile.sha256" "$outfile.metadata"
printf 'Sauvegarde créée : %s\nEmpreinte : %s\nMétadonnées : %s\n' "$outfile" "$(cut -d ' ' -f 1 "$outfile.sha256")" "$outfile.metadata"
