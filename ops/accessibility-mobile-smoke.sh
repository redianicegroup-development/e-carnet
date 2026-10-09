#!/usr/bin/env bash
set -euo pipefail
BASE_URL="${1:-http://127.0.0.1:3000}"
command -v chromium >/dev/null || { echo "BLOCKED: chromium absent" >&2; exit 2; }
tmpdir="$(mktemp -d)"; trap 'rm -rf "$tmpdir"' EXIT
routes=(/connexion /inscription /onboarding/identite /onboarding /patient /professionnel)
for route in "${routes[@]}"; do
  file="$tmpdir/$(echo "$route" | tr '/' '_').html"
  chromium --headless --no-sandbox --disable-gpu --dump-dom "$BASE_URL$route" > "$file" 2>/dev/null
  grep -q '<main' "$file" || { echo "FAIL: $route sans landmark main"; exit 1; }
  grep -q 'lang="fr"\|lang="fr-FR"' "$file" || { echo "FAIL: $route sans langue française"; exit 1; }
  if grep -q '<img' "$file" && ! grep -q 'alt=' "$file"; then echo "FAIL: $route image sans alt"; exit 1; fi
done
printf 'PASS: %s routes smoke-test mobile Chromium, main/lang/alt présents\n' "${#routes[@]}"
