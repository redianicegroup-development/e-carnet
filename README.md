# Mon E-Carnet — V1 en construction

**État documentaire : 6 novembre 2026.** La référence du code, des configurations de déploiement présentes et des limites connues est [`docs/ETAT-REEL-PROJET-2026-11-06.md`](docs/ETAT-REEL-PROJET-2026-11-06.md). Une fonction présente dans le dépôt n’est pas nécessairement déployée, testée en staging ou autorisée pour des données réelles.

Monorepo d’une application web/PWA mobile-first : Next.js, API Django/DRF et PostgreSQL cible. Le service est en phase de test : utiliser uniquement des données fictives (`example.test`). Les pages juridiques affichent encore un statut provisoire et ne constituent pas un avis juridique.

## Fonctionnalités présentes dans le code

- Comptes nominatifs et sessions serveur Django. Dans les configurations de référence, la session persiste après fermeture de la PWA et expire après 30 jours sans activité ; une déconnexion explicite met fin à la session. Les valeurs d’un environnement hébergé peuvent être différentes.
- Espaces patient, professionnel et établissement avec contrôles d’autorisation côté API. Le dépôt contient le carnet, les consultations et pré-consultations, les documents, mesures, vaccinations, rendez-vous, rappels, notifications et plans de suivi selon les rôles et permissions.
- Carte d’urgence virtuelle, QR public activé par le patient et téléchargement PNG. Les éléments de la carte sont des déclarations et doivent être vérifiés par les professionnels. Une carte ouverte par QR est copiée jusqu’à 24 h dans IndexedDB sans chiffrement applicatif sur l’appareil qui la consulte.
- Mode PWA hors connexion : les coquilles d’écrans et ressources peuvent être rechargées ; des lectures API éligibles sont conservées en cache chiffré, en lecture seule. Durée maximale : 7 jours pour les données du patient/compte et 24 h pour les informations de tiers. Aucune écriture n’est mise en attente ou rejouée hors connexion.
- OAuth Google, Facebook et Apple présent dans le code ; les identifiants fournisseurs et la recette réelle restent à fournir.

## Limites à ne pas confondre avec des fonctions autorisées

- Les données de santé réelles sont interdites dans l’état documenté du projet (`REAL_HEALTH_DATA_ALLOWED = false`).
- L’ouverture clinique par un administrateur d’établissement est désactivée par défaut dans le code et les modèles d’environnement. A8 reste à trancher ; aucune ouverture ne doit être activée avant validation. L’écran d’ouverture n’est pas présent.
- ETA-13 / E4 — plusieurs administrateurs avec rôles propriétaire et gestionnaire — n’est pas implémenté. Le modèle d’administrateur actuel demeure.
- PAT-21 — budget faible débit mesuré sur Android modeste et cinq essais utilisateur réels, dont une personne âgée — n’est pas déclaré terminé.
- Les validations médicales et juridiques, la recette de déploiement, les appareils mobiles, la conformité d’hébergement et la restauration de la base hébergée ne sont pas établies par le contenu de cette archive.

## Structure

- `apps/web` : interface Next.js et PWA.
- `apps/api` : API Django/DRF.
- `docs` : état du projet, décisions, guides de déploiement et rapports datés.
- `ops` : scripts de recette et d’exploitation.
- `render.yaml` : modèle Blueprint Render ; ne prouve pas qu’un service est en ligne ni que ses secrets sont configurés.

## Démarrer en local

Prérequis : Node.js 22+, npm 10+, Python 3.12+, Docker Engine et Docker Compose v2 pour PostgreSQL local.

```bash
cp .env.example .env
# Remplacer les secrets de développement par des valeurs aléatoires locales.
docker compose up --build
```

- Web : <http://localhost:3000>
- API liveness : <http://localhost:8000/api/v1/health/live/>
- API readiness : <http://localhost:8000/api/v1/health/ready/>
- PostgreSQL local : `localhost:5432`

Les services locaux sont liés à `127.0.0.1`. `docker compose down -v` supprime le volume local.

## Contrôles courants

```bash
npm ci
npm run test:api
npm run check:api
(cd apps/api && python manage.py makemigrations --check --dry-run)
npm run lint
npm run build
```

Les tests web ciblés peuvent être exécutés depuis `apps/web` avec `node --experimental-strip-types --no-warnings --import ./tests/helpers/register-ts-resolver.mjs --test tests/<fichier>.test.mjs` (adapter au fichier de test concerné). Un résultat local ne vaut pas recette staging.

## Références

- [État réel du projet — 06/11/2026](docs/ETAT-REEL-PROJET-2026-11-06.md)
- [Journal des changements](docs/CHANGELOG.md)
- [Déploiement](docs/DEPLOYMENT.md) et [plan d’architecture daté](docs/prod.md)
- [Sécurité](docs/SECURITY.md) et [mode hors connexion](docs/PWA-HORS-CONNEXION.md)
- [Décision « données de santé réelles »](docs/DONNEES-REELLES-DECISION.md)
- [Roadmap V1–V5](docs/ROADMAP-V1-V5.md)
- [Rapports et décisions datés](docs/)
