#!/usr/bin/env bash
# Archive propre du dépôt : jamais de secrets (.env), de base locale (*.sqlite3), de fichiers téléversés (private-media), de dépendances ni de caches.
# Usage : ./scripts/make-archive.sh [chemin-du-zip]   (par défaut : ../e-carnet-AAAAMMJJ.zip)
set -euo pipefail
cd "$(dirname "$0")/.."
out="${1:-../e-carnet-$(date +%Y%m%d).zip}"
rm -f "$out"

# .env.example reste inclus (il documente les variables sans valeur secrète).
find . -type f \
  | grep -vP '(^|/)(node_modules|\.next|__pycache__|\.git|private-media)/|\.pyc$|\.sqlite3(-journal)?$|\.zip$|(^|/)\.env(\.(?!example$).*)?$' \
  | zip -q "$out" -@

# Contrôle final : on refuse de livrer une archive qui contiendrait quand même un secret ou une base.
if unzip -Z1 "$out" | grep -qP '(^|/)\.env(\.(?!example$).*)?$|\.sqlite3$|(^|/)private-media/'; then
  echo "ERREUR : l'archive contient un fichier sensible ; elle a été supprimée." >&2
  rm -f "$out"
  exit 1
fi
echo "Archive créée : $out ($(unzip -Z1 "$out" | wc -l) fichiers, sans .env, base locale ni fichier téléversé)"
