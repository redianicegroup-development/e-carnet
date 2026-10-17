#!/usr/bin/env python3
"""Vérifie que apps/api/requirements.txt est bien un fichier verrouillé.

Chaque dépendance doit être épinglée (`nom==version`) et porter ses empreintes (`--hash=sha256:...`) : pip passe alors
en mode « empreintes obligatoires » et refuse tout paquet modifié ou non listé, y compris les dépendances transitives.
Une plage (`Django>=5.2,<5.3`) donne un build différent selon le jour : c’est ce que ce contrôle empêche.

Usage : python scripts/check-requirements-lock.py [chemin]   (code de sortie 1 si le fichier n’est pas verrouillé)
Régénérer : make lock
"""
import re
import sys
from pathlib import Path

path = Path(sys.argv[1] if len(sys.argv) > 1 else "apps/api/requirements.txt")
text = path.read_text(encoding="utf-8")
# Une exigence = un bloc qui commence par une ligne non vide, non commentée, non option, avec ses continuations « \\ ».
blocks, current = [], []
for raw in text.splitlines():
    line = raw.strip()
    if not line or line.startswith("#"):
        continue
    current.append(line.rstrip("\\").strip())
    if not raw.rstrip().endswith("\\"):
        blocks.append(" ".join(current))
        current = []
problems = []
for block in blocks:
    if block.startswith("-"):
        continue
    name = block.split()[0]
    if not re.match(r"^[A-Za-z0-9_.\-]+(\[[A-Za-z0-9_,.\-]+\])?==[^=<>!~,\s]+$", name):
        problems.append(f"{name} : version non épinglée (attendu nom==version)")
    elif "--hash=sha256:" not in block:
        problems.append(f"{name} : empreinte sha256 manquante")
if not blocks:
    problems.append("aucune dépendance trouvée")
if problems:
    print(f"{path} n’est pas verrouillé :")
    for problem in problems:
        print(f"  - {problem}")
    print("Lancez `make lock` (Python 3.12, accès au réseau), vérifiez le diff, puis commitez requirements.txt.")
    sys.exit(1)
print(f"{path} : {len(blocks)} dépendances épinglées avec empreintes.")
