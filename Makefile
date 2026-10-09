.PHONY: up down build logs test lint check

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
