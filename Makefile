.PHONY: up down build logs test lint check lock check-lock

up:
	docker compose up --build

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f api web db

test:
	npm run test:api

lint:
	npm run lint

check:
	npm run check:api

# Verrouille les dépendances Python (versions exactes + empreintes) à partir de apps/api/requirements.in.
# À lancer avec Python 3.12 (celui de l'image Docker) et un accès réseau ; relire le diff puis commiter requirements.txt.
lock:
	python3 -m pip install --quiet "pip-tools>=7.4"
	cd apps/api && python3 -m pip_tools compile --quiet --generate-hashes --strip-extras --resolver=backtracking --output-file=requirements.txt requirements.in
	python3 scripts/check-requirements-lock.py

check-lock:
	python3 scripts/check-requirements-lock.py
