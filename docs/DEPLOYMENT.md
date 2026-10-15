# Développement, Docker et déploiement

**Revu le 08/10/2026.** Les données restent fictives. PostgreSQL 16 local et restauration isolée ont une preuve réussie ; aucun staging/production n’est déclaré prêt.

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

Le flow d’invitation est présent côté API/UI : lien hashé à usage unique valable 48 h, activation et choix du mot de passe par le destinataire. L’API n’inclut jamais le jeton brut dans sa réponse staff ; l’e-mail d’invitation le transporte. L’envoi utilise le backend SMTP configurable : configurer et tester les identifiants SMTP, SPF/DKIM/DMARC et le domaine expéditeur en staging avant production. Les preuves légales de la structure sont examinées hors application ; leur rétention, leurs accès et leur suppression restent à décider avec conseil juridique. Les justificatifs professionnels des médecins ne sont pas collectés par la plateforme. Le V1/V2 restent sur Vercel + Render + Neon ; l’éventuelle centralisation sur VPS est à réévaluer après V2 et après validation juridique, sécurité, sauvegardes et exploitation.

## Tâches planifiées et limites de débit

- `python manage.py cleanup_access_qr_tokens` : supprime les QR de consultation expirés ou consommés depuis plus de 24 h (`--retention-hours N`). À planifier chaque jour (cron Render ou équivalent) ; sans elle, les jetons expirés s’accumulent, sans risque d’accès mais avec un coût de stockage.
- Limites ajoutées le 14/10 : `ECARNET_RATE_QR_CREATE` (création de QR de consultation, défaut `30/hour`) et `ECARNET_RATE_EMERGENCY_CARD` (page publique de carte d’urgence, par IP, défaut `120/hour`). Le cache de limitation doit être partagé entre instances en production.
- Migration `patients.0007_patientemergencycard_city` à appliquer avant de déployer la nouvelle carte d’urgence.

## Configuration de mots de passe

Argon2id est déclaré dans `apps/api/requirements.txt` et est le premier hasher Django. PBKDF2 reste déclaré pour vérifier les anciens hachages et permettre la mise à niveau. Vérifier le comportement sur la base staging et ne jamais exporter les vrais hashes dans un rapport.

## Profils représentés et transfert adulte

`ECARNET_REPRESENTATION_LEGAL_AGE` est volontairement vide par défaut. Ne la renseigner qu’après validation juridique du seuil applicable; tant qu’elle est vide, la création de profils représentés et les demandes de transfert sont bloquées. L’approbation d’un transfert exige une vérification manuelle de l’identité du demandeur et de son âge légal via la file dédiée de la console admin (superutilisateurs uniquement). Aucune pièce d’identité n’est collectée par l’application; définir et valider la procédure probante hors application avant la production.

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

Local, preview et staging utilisent uniquement des données synthétiques. Le choix actuel V1/V2 est Vercel + Render + Neon ; un VPS reste une piste ultérieure, sans présumer qu’il est automatiquement plus conforme. Une preuve locale de restauration PostgreSQL existe depuis le 08/10 (voir les rapports ci-dessus). Avant toute donnée réelle : cartographie des lieux de traitement/sauvegarde/journaux, validations juridique et médicale, politique de conservation approuvée, domaine/HTTPS, cookies/CSRF, PostgreSQL/trigger, sauvegardes/restaurations et RPO/RTO mesurés, procédure d’incident, sécurité SVG, revue de dépendances, OAuth configuré, console staff et espace établissement privés, SMTP vérifié et invitation testée. Aucun Compose local ne remplace ces preuves.


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

## Configuration production (valeurs par défaut sûres)

- `DJANGO_DEBUG` vaut `false` si absent : sans `DJANGO_SECRET_KEY` l'application refuse de démarrer.
- HTTPS : redirection, `SECURE_PROXY_SSL_HEADER`, HSTS 1 jour (relever ensuite), cookies Secure et `SameSite=None`. Les sondes `/api/v1/health/` sont exemptées de la redirection.
- `DRF_NUM_PROXIES` : nombre de proxys de confiance (1 par défaut hors debug). Une valeur fausse rend l'IP client falsifiable et affaiblit la limitation des tentatives.
- Limitation des tentatives : compteurs dans la table `ecarnet_cache`, créée automatiquement par `manage.py migrate`. Console d'administration : 10 essais de connexion par 15 minutes et par IP ; changer `DJANGO_ADMIN_PATH`. Les comptes staff n'ont pas de MFA en V1 : mots de passe longs obligatoires.
- Invitation établissement : l’API ne renvoie jamais le jeton brut ; un lien est envoyé via le backend SMTP configurable. La configuration SMTP, SPF/DKIM/DMARC et la délivrabilité restent à vérifier sur staging.
