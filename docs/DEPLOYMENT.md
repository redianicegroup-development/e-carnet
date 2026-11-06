> **Référence d’état auditée le 06/11/2026.** L’état courant du code, des tests et de l’exploitation est centralisé dans [`ETAT-REEL-PROJET-2026-11-06.md`](ETAT-REEL-PROJET-2026-11-06.md). Les documents datés conservent leur valeur historique ; leurs affirmations ne remplacent pas le code ni cette référence. Une fonctionnalité présente dans le dépôt n’est pas pour autant déployée, validée en staging ou autorisée pour des données réelles.

# Développement, Docker et déploiement

**Mise à jour le 06/11/2026.** Les données restent fictives. Les exemples du dépôt décrivent Render pour l’API et Vercel/Neon dans l’architecture documentée ; ils ne prouvent ni un déploiement actuel ni une recette staging.

## Prérequis

- Node.js 22+ avec npm 10+;
- Python 3.12+;
- Docker Engine et Docker Compose v2 pour l’exécution complète.

## Pile locale

À la racine :

```bash
cp .env.example .env
# Remplacer les secrets par des valeurs aléatoires locales.
docker compose config
docker compose up --build
```

Services : Web `http://localhost:3000`; API `http://localhost:8000/api/v1/health/live/`; readiness `http://localhost:8000/api/v1/health/ready/`; PostgreSQL local `localhost:5432`. Les ports sont bindés à `127.0.0.1`. `docker compose down -v` supprime le volume de données fictives.

## Dépendances et contrôles

```bash
npm ci
npm run test:api
npm run check:api
(cd apps/api && python manage.py makemigrations --check --dry-run)
npm run lint
npm run build
```

## Image frontend de production

`apps/web/Dockerfile` utilise maintenant trois étapes : installation des dépendances, build Next.js et image d’exécution minimale. L’image finale ne lance jamais `next dev` : elle utilise le serveur standalone avec un utilisateur non root (`nextjs`, UID 1001).

Depuis la racine du dépôt :

```bash
docker build \
  --build-arg ECARNET_API_ORIGIN=https://api.example.tld \
  -f apps/web/Dockerfile \
  -t ecarnet-web:production .
docker run --rm -p 3000:3000 ecarnet-web:production
```

`ECARNET_API_ORIGIN` est injecté au build, car il sert à générer la règle de réécriture Next.js. Sur Render ou Hodi, le renseigner dans les arguments de build avec l’URL publique de l’API, sans slash final. Ne pas confondre cette valeur avec `NEXT_PUBLIC_API_URL`, qui doit également être définie si le frontend l’utilise côté navigateur.

Le build active `output: "standalone"` et conserve le monorepo UI grâce à `outputFileTracingRoot`. Le conteneur expose le port `3000`, écoute sur `0.0.0.0` et doit recevoir le port fourni par l’hébergeur via sa configuration de service. Le Compose local reste volontairement en mode développement pour préserver le hot reload ; l’image ci-dessus est la référence staging/production.

Vérifications de code consignées le 05/10/2026 (soir) : 71 tests Django OK et 1 ignoré sous SQLite, check/migrations/lint/tsc OK, build avec 31 routes ; `npm audit --omit=dev` ne trouvait alors aucune vulnérabilité de production, avec 5 alertes `high` dans l’outillage. Authlib signalait `authlib.jose` déprécié. Ces relevés n’ont pas été rejoués le 08/10 : ne pas présenter leur nombre de tests/routes ni leur état de dépendances comme résultats actuels.

Le 08/10/2026, la suite Django a réussi sur PostgreSQL 16 local : 77 tests, zéro échec et zéro ignoré ; un smoke séparé a restauré une archive dans une base isolée. Ces preuves ne concernent pas Neon/staging et ne mesurent pas le RPO/RTO opérationnel : voir [rapport de tests](../reports/postgres-tests-20261008.txt) et [rapport de restauration](../reports/postgres-restore-20261008T081823Z.txt).

## OAuth (non activé sans credentials)

Le backend lit les variables ci-dessous; les valeurs des exemples sont des placeholders, **pas des secrets valides**. Pour les variables de production, voir [`apps/api/.env.production.example`](../apps/api/.env.production.example) et [`apps/web/.env.production.example`](../apps/web/.env.production.example) :

| Fournisseur | Variables |
|---|---|
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Facebook | `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET` |
| Apple | `APPLE_CLIENT_ID`, `APPLE_CLIENT_SECRET` |

Déclarer chaque URL de callback exacte côté fournisseur, conformément au domaine staging/production. Les callbacks sont générés sur `/api/v1/identity/oauth/<provider>/callback/`. Garder les secrets dans le gestionnaire de secrets ou variables d’environnement, jamais dans Git. L’implémentation possède les routes, le retour UI, l’identité externe, la liaison/déliaison et l’audit ; les tests fournisseurs et les credentials réels sont à fournir. Apple exige un client secret au format et à la durée conformes au setup Sign in with Apple et un compte Developer valide.

Lier une identité secondaire doit se faire après connexion au compte existant; une adresse email correspondante seule ne déclenche aucune fusion.

## Invitations établissement — finition avant production

Le flow d’invitation est présent côté API/UI : lien hashé à usage unique valable 48 h, activation et choix du mot de passe par le destinataire. L’API n’inclut jamais le jeton brut dans sa réponse staff ; l’e-mail d’invitation le transporte. L’envoi utilise le backend SMTP configurable : configurer et tester les identifiants SMTP, SPF/DKIM/DMARC et le domaine expéditeur en staging avant production. Les preuves légales de la structure sont examinées hors application ; leur rétention, leurs accès et leur suppression restent à décider avec conseil juridique. Les justificatifs professionnels des médecins ne sont pas collectés par la plateforme. Le Blueprint présent dans le dépôt (`render.yaml`) configure Render ; `prod.md` conserve une décision d’architecture datée Vercel/Render/Neon, tandis que Hodi apparaît dans des notes d’étude. Le fournisseur réellement utilisé et les confirmations d’hébergement ne sont pas établis par ces fichiers. Aucune donnée réelle n’est autorisée sur la seule base d’un modèle de déploiement.

## Tâches planifiées, surveillance et limites de débit

ADM-10 est livré côté dépôt avec une sonde serveur toutes les cinq minutes et une sonde HTTP indépendante. Installer les exemples `ops/monitoring-cron.example` et `ops/monitoring-external-cron.example`, renseigner les secrets hors Git et suivre `docs/MONITORING-WEBHOOK.md`. Cette présence dans le dépôt ne constitue pas une installation sur l’hébergeur.

- `python manage.py cleanup_access_qr_tokens` : supprime les QR de consultation expirés ou consommés depuis plus de 24 h (`--retention-hours N`). À planifier chaque jour (cron Render ou équivalent) ; sans elle, les jetons expirés s’accumulent, sans risque d’accès mais avec un coût de stockage.
- Limites ajoutées le 14/10 : `ECARNET_RATE_QR_CREATE` (création de QR de consultation, défaut `30/hour`) et `ECARNET_RATE_EMERGENCY_CARD` (page publique de carte d’urgence, par IP, défaut `120/hour`). Le cache de limitation doit être partagé entre instances en production.
- Migration `patients.0007_patientemergencycard_city` à appliquer avant de déployer la nouvelle carte d’urgence.

## Configuration de mots de passe

Argon2id est déclaré dans `apps/api/requirements.txt` et est le premier hasher Django. PBKDF2 reste déclaré pour vérifier les anciens hachages et permettre la mise à niveau. Vérifier le comportement sur la base staging et ne jamais exporter les vrais hashes dans un rapport.

## Profils représentés et transfert adulte

`ECARNET_REPRESENTATION_LEGAL_AGE` est volontairement vide par défaut. Ne la renseigner qu’après validation juridique du seuil applicable; tant qu’elle est vide, la création de profils représentés et les demandes de transfert sont bloquées. L’approbation d’un transfert exige une vérification manuelle de l’identité du demandeur et de son âge légal via la file dédiée de la console admin (superutilisateurs uniquement). Aucune pièce d’identité n’est collectée par l’application; définir et valider la procédure probante hors application avant la production.

- `ECARNET_ESTABLISHMENT_ADMIN_CLINICAL_READ` vaut `false` par défaut : l'ouverture et la lecture d'un dossier par l'administrateur d'établissement sont désactivées. Ne passer à `true` qu'après la validation juridique A8 et la mise en place de l'écran d'ouverture. `ECARNET_RECORD_OPENING_TTL_MINUTES` fixe la durée d'une ouverture (30 par défaut, jamais illimitée, 240 au plus).

## Installation native

```bash
npm ci
npm run dev
```

API dans un autre terminal :

```bash
python3 -m venv apps/api/.venv
. apps/api/.venv/bin/activate
pip install -r apps/api/requirements.txt
cd apps/api
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

Sans `DATABASE_URL`, Django utilise SQLite pour le local/tests seulement; le pilote doit utiliser PostgreSQL. `DEBUG=false` sans `DJANGO_SECRET_KEY` est refusé. `runserver` et `next dev` ne sont pas des serveurs de production.

## Séparation environnements et mise en production

Local, preview et staging doivent utiliser uniquement des données synthétiques. Le code d’exemple actuel décrit Render pour l’API et une architecture documentée Vercel/Render/Neon ; le plan Hodi reste une étude séparée et aucune connexion à un fournisseur n’est prouvée par cette archive. Les décisions de capacité, reverse proxy, PostgreSQL et stockage privé doivent être prises et vérifiées dans l’environnement retenu. Une preuve locale de restauration PostgreSQL existe depuis le 08/10 (voir les rapports ci-dessus), mais elle ne vaut pas preuve d’un hébergeur. Avant toute donnée réelle : cartographie des lieux de traitement/sauvegarde/journaux, validations juridique et médicale, politique de conservation approuvée, domaine/HTTPS, cookies/CSRF, PostgreSQL/trigger, sauvegardes/restaurations et RPO/RTO mesurés, procédure d’incident, sécurité SVG, revue de dépendances, OAuth configuré, console staff et espace établissement privés, SMTP vérifié et invitation testée. Aucun Compose local ne remplace ces preuves. Voir [`AKATECH-PLAN-OPTIMISATION-CHARGE-HODI.md`](AKATECH-PLAN-OPTIMISATION-CHARGE-HODI.md) pour les seuils de cette étude de charge.


## Domaine et cookies — requis avant le staging

L'authentification utilise une session Django. Un frontend `*.vercel.app` appelant une API `*.onrender.com` crée un contexte tiers : Safari/iOS peut bloquer le cookie de session, même avec `SameSite=None; Secure`. Le jeton CSRF en JSON ne remplace pas cette session. Ne pas utiliser ces deux domaines fournisseur ensemble pour une connexion réelle.

Utiliser un domaine contrôlé par le projet, par exemple `mon-carnet.ci`, et rattacher **les deux** domaines personnalisés dans les tableaux de bord Vercel et Render : `app.mon-carnet.ci` pour Next.js et `api.mon-carnet.ci` pour Django. Ajouter les enregistrements DNS exacts indiqués par ces plateformes et attendre la validation HTTPS. Les domaines `.vercel.app` et `.onrender.com` peuvent rester des URL techniques, mais ne sont pas les URL d'accès destinées aux utilisateurs.

Configurer ensuite les variables suivantes (sans slash final) :

- Vercel : `NEXT_PUBLIC_API_URL=https://api.mon-carnet.ci` ; redéployer après modification, car cette variable est intégrée au bundle Next.js.
- Render : inclure `api.mon-carnet.ci` **et** le hostname `*.onrender.com` dans `DJANGO_ALLOWED_HOSTS` (sans protocole).
- Render : `WEB_ORIGIN=https://app.mon-carnet.ci`, `CORS_ALLOWED_ORIGINS=https://app.mon-carnet.ci` et `CSRF_TRUSTED_ORIGINS=https://app.mon-carnet.ci`.
- Garder `SESSION_COOKIE_SAMESITE=None` et `CSRF_COOKIE_SAMESITE=None` en production ; les cookies sont `Secure`. Le `None` de la session permet aussi le callback OAuth Apple en POST. Ces valeurs ne rendent pas sûrs les domaines fournisseur croisés : le domaine personnalisé commun est impératif.
- Ne pas définir `SESSION_COOKIE_DOMAIN` ni `CSRF_COOKIE_DOMAIN`. Le navigateur reçoit les cookies host-only sur l'origine `app.` via le proxy Next.js ; aucun cookie partagé sur le domaine parent n'est requis.
- Enregistrer auprès de chaque fournisseur OAuth le callback exact `https://app.mon-carnet.ci/api/v1/identity/oauth/<fournisseur>/callback/` (l'API est atteinte via le proxy Next.js).

La configuration CORS/CSRF reste nécessaire, car `app.` et `api.` sont deux origines différentes même s'ils sont same-site. Tester connexion, déconnexion, rafraîchissement de page et OAuth dans Safari sur iOS avant ouverture.

La session Django est persistante après fermeture du navigateur et glissante à chaque requête. Le code, `.env.production.example` et `render.yaml` définissent une durée de référence de **30 jours sans activité** (`ECARNET_SESSION_AGE_SECONDS=2592000`). Une valeur saisie dans le tableau de bord peut la remplacer ; vérifier la valeur réelle du service et ne pas annoncer sa durée avant cette vérification. Fermer la PWA sans choisir « Déconnexion » ne supprime pas à elle seule le cookie.

`ECARNET_ESTABLISHMENT_ADMIN_CLINICAL_READ` reste explicitement à `false` dans les exemples et dans le Blueprint de référence. Ne pas passer cette valeur à `true` avant la décision A8, l’écran d’ouverture et les validations requises ; la valeur d’un service déjà déployé doit être vérifiée séparément.

`ECARNET_ESTABLISHMENT_ADMIN_CLINICAL_READ` reste explicitement à `false` dans les exemples et dans le Blueprint de référence. Ne pas passer cette valeur à `true` avant la décision A8, l’écran d’ouverture et les validations requises ; la valeur de tout service déjà déployé est à vérifier séparément.

## Configuration production (valeurs par défaut sûres)

- `DJANGO_DEBUG` vaut `false` si absent : sans `DJANGO_SECRET_KEY` l'application refuse de démarrer.
- HTTPS : redirection, `SECURE_PROXY_SSL_HEADER`, HSTS 1 jour (relever ensuite), cookies Secure et `SameSite=None`. Les sondes `/api/v1/health/` sont exemptées de la redirection.
- `DRF_NUM_PROXIES` : nombre de proxys de confiance (1 par défaut hors debug). Une valeur fausse rend l'IP client falsifiable et affaiblit la limitation des tentatives.
- Limitation des tentatives : compteurs dans la table `ecarnet_cache`, créée automatiquement par `manage.py migrate`. Console d'administration : 10 essais de connexion par 15 minutes et par IP ; changer `DJANGO_ADMIN_PATH`. Les comptes staff n'ont pas de MFA en V1 : mots de passe longs obligatoires.
- Surveillance technique : renseigner `ECARNET_OPERATIONS_ADMIN_EMAILS` avec un ou plusieurs e-mails de superadministrateurs autorisés, séparés par des virgules. La connexion utilise le mot de passe normal du compte Django ; aucun compte partagé ni mot de passe de monitoring n'est créé. La même variable fonctionne en local, sur Render et sur Hodi. **Elle est obligatoire hors développement** : liste vide, personne n'accède à la console (seul `DEBUG` local l'ouvre aux superadmins de test). `ECARNET_ENVIRONMENT=staging|production` fixe l'étiquette affichée. Le webhook de monitoring demande un horodatage signé : voir `docs/MONITORING-WEBHOOK.md` et `ops/send-monitoring-event.py`.
- Invitation établissement : l’API ne renvoie jamais le jeton brut ; un lien est envoyé via le backend SMTP configurable. La configuration SMTP, SPF/DKIM/DMARC et la délivrabilité restent à vérifier sur staging.
