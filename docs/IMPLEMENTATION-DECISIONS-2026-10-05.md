# Implémentation des décisions — 5 octobre 2026

> Journal historique des changements et validations de cette date, pas un état actuel ni une liste active de tâches. Depuis, voir [l’état réel V1](ETAT-REEL-V1.md), les [décisions produit](QUESTIONNAIRE-DECISIONS-A1-A16.md) et les [preuves PostgreSQL du 08/10](../reports/postgres-tests-20261008.txt).

## Décisions A9 appliquées

- **QR :** jeton opaque, stocké uniquement sous forme de hash, à usage unique, valable **5 minutes** (`ECARNET_QR_TTL_SECONDS`, défaut `300`).
- **Scopes V1 :** `preconsultation` + `declarations` par défaut ; `consultations` est sélectionnable ; **`documents` est hors périmètre V1**.
- Le contrat QR renvoie maintenant la durée et le scope par défaut à l’interface, et les libellés UI annoncent 5 minutes.

## Identité / avatar / onboarding

- Ajout du modèle `AccountProfile` lié 1–1 au compte, avec avatar URL éditable et supprimable.
- Inscription email : création du profil d’identité dès le compte créé.
- Nouveau parcours `/onboarding/identite` avant le choix Patient/Professionnel.
- Écran de paramètres patient alimenté par le compte réel : nom, prénom, avatar, initiales et état de session.

## OAuth complet côté application

- Callback OAuth Google/Facebook/Apple avec retour UI `/connexion?oauth=…&status=…&message=…`.
- Liaison explicite depuis une session authentifiée ; aucune fusion silencieuse d’un compte existant par simple email.
- Liste des fournisseurs liés et endpoint de déliaison.
- Impossible de supprimer la dernière méthode OAuth d’un compte sans mot de passe utilisable.
- Événements d’audit `oauth.account_created`, `oauth.identity_linked` et `oauth.identity_unlinked` avec le seul nom du fournisseur, jamais les secrets/tokens.
- Les secrets et URLs fournisseurs restent configurables par variables d’environnement ; un fournisseur non configuré renvoie une erreur UI contrôlée.

## Validation

- `npm run test:api` : **55 tests OK, 1 ignoré** (concurrence SQLite déjà connue).
- `npm run check:api` : OK.
- `python3 apps/api/manage.py makemigrations --check --dry-run` : aucune migration manquante.
- `npm run lint` : aucune erreur, deux avertissements non bloquants sur l’usage d’`<img>` pour les avatars distants.
- `npm run build` : OK, 27 routes Next.js générées.

## À faire avant staging/production

- Fournir les credentials et redirect URIs réels Google/Facebook/Apple.
- Remplacer l’import déprécié `authlib.jose` par `joserfc` avec recette JWT Apple.
- Recetter cookies/CSRF sur les domaines réels, QR sur mobile et PostgreSQL.

## Durcissement et recette finale — 5 octobre 2026

- Remplacement de la blacklist SVG par `apps/api/apps/care/svg_sanitizer.py`, avec allowlist stricte de primitives de dessin et attributs sûrs.
- Refus des DTD/entités XML, scripts, CSS, références `url()`/`data:`/`javascript:`, médias, éléments externes, texte et namespaces non autorisés.
- Ajout de tests adversariaux SVG ; la suite API est passée à **57 tests OK, 1 ignoré**.
- Ajout de `ops/accessibility-mobile-smoke.sh` : smoke Chromium headless sur six routes, landmarks, langue et attributs `alt`.
- Ajout de `ops/staging-gates.sh` : configuration Compose, PostgreSQL, backup SHA-256, restauration isolée, readiness et manifeste des routes.
- Rapport final : **NO-GO staging/production** tant que Docker/PostgreSQL, restauration et staging réel ne sont pas disponibles et signés.
