# Mon Carnet Numérique — V1 en construction

Monorepo d’une application web/PWA mobile-first : Next.js 16, API Django/DRF et PostgreSQL cible.

> **État documentaire vérifié le 08/10/2026. V1 en construction, non acceptée et non autorisée pour des données de santé réelles.**
> Les tests PostgreSQL 16 et le smoke local de sauvegarde/restauration ont réussi. Le verdict reste **NO-GO** : ils ne remplacent ni une recette staging, ni une sauvegarde managée testée, ni l’approbation du RPO/RTO et des validations produit, juridiques et sécurité.

## Dernières preuves disponibles

- Le 08/10, `npm run test:api -- --keepdb` sur PostgreSQL 16 local : **77 tests réussis, aucun échec, aucun ignoré**. Voir [rapport de tests PostgreSQL](reports/postgres-tests-20261008.txt).
- Le 08/10, une sauvegarde PostgreSQL custom a été restaurée dans une base isolée ; empreinte, marqueur synthétique et migrations vérifiés. La commande de restauration a pris 1 s, ce qui **ne mesure pas** le RTO d’un service. Voir [rapport de restauration](reports/postgres-restore-20261008T081823Z.txt).
- Les derniers résultats documentés du lint, du build, du contrôle Django, des migrations et du smoke Chromium datent du **05/10** : voir [état réel V1](docs/ETAT-REEL-V1.md). Ils n’ont pas été rejoués dans cette mise à jour documentaire.
- Les alertes npm et l’avertissement Authlib rapportés le 05/10 sont des observations historiques ; leur état actuel n’a pas été revérifié.
- Le staging réel, les sauvegardes managées, le RPO/RTO, les domaines/cookies/SMTP/OAuth réels, les essais Android/iOS et les validations médicales/juridiques restent à prouver.

Pour éviter de réintroduire un ancien choix : [état réel et hiérarchie documentaire](docs/ETAT-REEL-V1.md) fait foi pour le code ; [roadmap](docs/ROADMAP-V1-V5.md) fait foi pour les décisions produit ; les rapports datés sont des preuves historiques, pas des spécifications actives.

## Fonctionnalités présentes

- Compte unique, sessions serveur, CSRF/CORS et Argon2id.
- Authentification e-mail/mot de passe et endpoints OAuth Google/Facebook/Apple : callbacks et interface de liaison/déliaison sont présents ; secrets et recette réelle fournisseur restent requis. Aucun compte n’est fusionné sur la seule égalité d’e-mail.
- Onboarding en trois étapes : identité/nom/avatar URL éditable, choix Patient/Professionnel, formulaire métier conditionnel.
- Profil patient, déclarations, pré-consultation, historique et consultation.
- AccessGrant : consentement, scopes V1, expiration serveur de 2 h, deux prolongations d’1 h et révocation.
- QR opaque, hashé en base, à usage unique, valable **5 minutes** ; A9 : `preconsultation` + `declarations` par défaut, `consultations` sélectionnable, `documents` hors V1. Le formulaire professionnel exige encore l’UUID patient en plus du jeton QR : le parcours n’est pas entièrement sans friction.
- Invitations établissement via transport SMTP Django configurable ; le jeton brut n’est jamais renvoyé dans une réponse API.
- Établissement privé : routes staff, administrateur nominatif historisé, invitation 48 h, code médecin 48 h à usage unique, demande `pending`, acceptation/refus et isolation.
- Audit applicatif, PWA et pages web des espaces principaux.
- Sanitation SVG par allowlist stricte : primitives de dessin uniquement, sans script/CSS/URL externe/DTD/média/namespace non autorisé.
- Scripts de recette PostgreSQL/restauration/staging et smoke mobile/accessibilité livrés.

## Ce qui bloque encore la V1

1. Répéter les tests PostgreSQL, trigger append-only et privilèges sur l’instance cible, notamment la protection `TRUNCATE` encore à compléter.
2. Vérifier les sauvegardes managées et restaurations sur staging, puis approuver et mesurer le RPO/RTO opérationnel.
3. Configurer et recetter domaines, HTTPS, SMTP/délivrabilité, OAuth fournisseurs et cookies/CSRF réels.
4. Tester Android/iOS/4G, le flux QR complet et l’accessibilité WCAG 2.2 AA ; le smoke Chromium local ne vaut pas certification.
5. Revoir les dépendances avec un audit daté ; les vulnérabilités npm du 05/10 ne sont pas réputées corrigées ou actuelles sans nouveau relevé. Traiter aussi la dépréciation `authlib.jose` avec des tests JWT Apple.
6. Obtenir les validations médicales, juridiques, hébergement/localisation, conservation, incidents et stockage privé.
7. Faire signer CA-01 à CA-24 et réévaluer le verdict **NO-GO**.

Tant que ces points ne sont pas prouvés et validés, utiliser uniquement des données synthétiques `example.test`.

## Documentation de référence

- [État réel V1](docs/ETAT-REEL-V1.md)
- [Rapport Go/No-Go (historique, complété le 08/10)](docs/GO-NO-GO-2026-10-05.md)
- [Décisions produit et cahier de charge A1–A16](docs/QUESTIONNAIRE-DECISIONS-A1-A16.md)
- [Roadmap produit V1–V5](docs/ROADMAP-V1-V5.md)
- [Plan d’implémentation V1](docs/V1-PLAN.md)
- [Matrice de recette V1](docs/RECETTE-V1.md)
- [Flow établissement](docs/FLOW-ETABLISSEMENT.md) · [ADR-002](docs/adr/ADR-002-etablissement-invitation-et-rattachement.md)
- [Audit initial du 05/10 (historique)](docs/RAPPORT-AUDIT-ECARNET.md)
- [Sécurité](docs/SECURITY.md) · [Déploiement](docs/DEPLOYMENT.md)
- [Journal d’implémentation du 05/10](docs/IMPLEMENTATION-DECISIONS-2026-10-05.md)

## Démarrer en local

Prérequis : Node.js 22+, npm 10+, Python 3.12+, Docker Engine et Docker Compose v2 pour la pile PostgreSQL complète.

```bash
cp .env.example .env
# Remplacer les secrets de développement par des valeurs aléatoires locales.
docker compose up --build
```

- Web : <http://localhost:3000>
- API liveness : <http://localhost:8000/api/v1/health/live/>
- API readiness : <http://localhost:8000/api/v1/health/ready/>
- PostgreSQL local : `localhost:5432`

Les services sont liés à `127.0.0.1`. `docker compose down -v` efface les données fictives du volume local.

## Contrôles

```bash
npm ci
npm run test:api
npm run check:api
(cd apps/api && python manage.py makemigrations --check --dry-run)
npm run lint
npm run build

# Après démarrage du web local
ops/accessibility-mobile-smoke.sh http://127.0.0.1:3000

# Sur un runner avec Docker/PostgreSQL
ops/staging-gates.sh reports/staging-gates-current.txt
```

Pour l’API hors Docker, utiliser un environnement virtuel Python et installer `apps/api/requirements.txt`.

## Sécurité des données

Développement, staging et pilote n’utilisent que des données fictives (`example.test`). Toute donnée réelle reste bloquée tant que l’hébergement ivoirien, les avis juridique/médical, le stockage privé, la sécurité SVG, le plan d’incident, la restauration testée et les gates Go/No-Go ne sont pas validés.
