# Mon Carnet Numérique — plan de production V1 → V3

> **Décision d’architecture — 08/10/2026** : utiliser **Vercel (frontend) + Render (API Django) + Neon (PostgreSQL)** en V1/V2. Ne pas migrer vers un VPS avant réévaluation après V2 fondée sur des besoins et mesures réels.

> Note d’architecture opérationnelle ; pour les instructions actuelles, lire [DEPLOYMENT.md](DEPLOYMENT.md), et pour le GO/NO-GO lire [ETAT-REEL-V1.md](ETAT-REEL-V1.md). Les relevés de build/dépendances datés du 05/10 ci-dessous ne sont pas un état actuel.

## 1. Avis global

**Décision du porteur — 08/10/2026 : conserver Vercel (frontend) + Render (API) + Neon (PostgreSQL) pour les versions V1 et V2. Pas de migration VPS pendant ces versions. Le stockage persistant canonique est PostgreSQL sur Neon ; Vercel sert le frontend et Render traite les requêtes API. Cette architecture répartit les composants et le traitement entre fournisseurs : elle ne garantit pas, à elle seule, que toutes les copies, journaux, métadonnées ou sauvegardes restent dans un seul pays. Cartographier ces flux et vérifier les contrats/localisations avant les données de santé réelles.

Pour la V1, l’objectif est de **valider le produit avant d’optimiser l’infrastructure**. On ne migre pas vers un VPS uniquement parce que les composants sont sur plusieurs plateformes. On migre lorsque des mesures réelles montrent un gain économique, de performance ou de contrôle.

La V1 ne doit pas être appelée production de données médicales réelles tant que les exigences de sécurité, restauration, conformité et exploitation ne sont pas validées.

Le code est déjà adapté à une migration ultérieure :

- monorepo séparant `apps/web` et `apps/api` ;
- API Django/DRF consommée par une URL configurable ;
- PostgreSQL via `DATABASE_URL` ;
- variables d’environnement déjà utilisées ;
- endpoint de santé live/ready ;
- Dockerfiles et Docker Compose pour une future installation VPS ;
- migrations Django versionnées.

### Mon avis sur le VPS

**Pas de VPS en V1 ni en V2, conformément à la décision du porteur du 08/10/2026.** Il ajouterait immédiatement la responsabilité de patcher Ubuntu, sécuriser SSH, gérer le reverse proxy, les certificats, les sauvegardes, le monitoring et les restaurations. Pour un pilote, cela ralentit le produit et augmente le risque opérationnel.

**Après V2 : VPS à réévaluer comme option de centralisation, pas obligation ni promesse de conformité.** On l’envisage uniquement lorsque l’un de ces déclencheurs est réel :

- besoin contractuel de localisation/souveraineté des données ;
- coût mensuel cumulé Vercel + Render + Neon qui devient disproportionné par rapport au trafic ;
- volume ou latence justifiant la centralisation ;
- besoin de contrôle réseau et d’archivage plus fin ;
- capacité à financer une mise en place DevOps et des sauvegardes hors serveur ;
- besoin de rapprocher l’infrastructure des utilisateurs ivoiriens après mesure de latence réelle.

Un VPS local n’est pas automatiquement conforme parce qu’il est situé en Côte d’Ivoire, au Bénin ou au Togo. Pour des données de santé, il faut obtenir des garanties contractuelles sur la localisation, les sauvegardes, les accès opérateur, le chiffrement, la disponibilité, la restauration et la réglementation applicable.

## 2. Architecture retenue par version

### V1 — pilote contrôlé et économique

```text
Navigateur
   │
   ▼
Vercel — Next.js (frontend)
   │ HTTPS / cookies de session / CORS-allowlist
   ▼
Render — Django/DRF (API)
   │ DATABASE_URL TLS
   ▼
Neon — PostgreSQL
```

- Données de développement, preview et staging : **uniquement synthétiques**.
- Redis/Upstash : **pas activé tant qu’une fonctionnalité ne l’exige pas**. Le dépôt actuel ne nécessite pas Redis pour démarrer la V1. Chaque nouveau service doit avoir une justification fonctionnelle ou mesurable.
- OAuth : activer fournisseur par fournisseur, après callback réel et test de bout en bout.

### V2 — staging, premières charges réelles et contrôle des coûts

- même découpage applicatif ;
- environnement staging séparé de la production ;
- projet/base Neon séparé(e), jamais une base partagée avec les tests ;
- cartographie explicite : données au repos, flux API, logs, fichiers, exports et sauvegardes ; garder les données cliniques hors logs et caches frontend ;
- domaine réel et sous-domaines dédiés ;
- SMTP de production vérifié ;
- sauvegarde/restauration testée avec RPO/RTO approuvés ;
- monitoring et alertes ;
- revue dépendances et tests PostgreSQL réels.

### Après V2 — option VPS à réévaluer, non décidée

```text
Internet
   │
   ▼
Caddy ou Nginx — TLS / reverse proxy
   ├── app.moncarnet.ci       → Next.js
   └── api.moncarnet.ci       → Gunicorn + Django
                                │
                                ├── PostgreSQL
                                ├── Redis seulement si justifié
                                └── stockage privé + sauvegardes hors VPS
```

Le passage V3 doit remplacer les **services**, pas les contrats. Le code applicatif doit rester portable :

- `NEXT_PUBLIC_API_URL` change de valeur ;
- `DATABASE_URL` pointe vers PostgreSQL VPS ou une base managée conservée ;
- les migrations Django restent la source de vérité ;
- le frontend ne connaît jamais l’implémentation de la base ;
- le backend garde les mêmes routes `/api/v1/...` ;
- Docker Compose devient le mode d’exécution du VPS ;
- un reverse proxy fournit les mêmes domaines HTTPS attendus par le navigateur.

## 3. Configuration Render — API Django

Le fichier [`render.yaml`](../render.yaml) configure le service Render à partir de [`apps/api/Dockerfile`](../apps/api/Dockerfile) :

- runtime Docker avec le contexte du dépôt ;
- installation des dépendances Python dans l’image ;
- migrations Django avant le démarrage de Gunicorn ;
- bind sur le port `PORT` fourni par Render ;
- health check `/api/v1/health/ready/` ;
- variables non secrètes dans le Blueprint et secrets à saisir dans Render.

### Paramètres à vérifier dans Render

1. Connecter le dépôt Git.
2. Utiliser le Blueprint [`render.yaml`](../render.yaml) ou recopier ses valeurs.
3. Vérifier que le service écoute bien sur `$PORT`.
4. Renseigner `DATABASE_URL` avec l’URL Neon **pooled ou non pooled selon le besoin**, fournie par Neon et non copiée dans Git.
5. Ajouter un domaine personnalisé commun avant d'ouvrir l'authentification : `app.<votre-domaine>` sur Vercel et `api.<votre-domaine>` sur Render. Suivre les valeurs DNS et la validation HTTPS fournies par chaque tableau de bord. Les URL `*.vercel.app` + `*.onrender.com` ne conviennent pas à la connexion Safari/iOS : les cookies de session tiers peuvent être bloqués.
   Pour des tests techniques temporaires sur les URL fournisseur, le Blueprint autorise actuellement `https://e-carnetci.vercel.app` ; cela ne lève pas la restriction des cookies tiers.

6. Définir `DJANGO_ALLOWED_HOSTS` avec le hostname Render **et** le domaine API personnalisé, sans protocole :

   ```text
   ecarnet-api.onrender.com,api.mon-carnet.ci
   ```

7. Définir `WEB_ORIGIN`, `CORS_ALLOWED_ORIGINS` et `CSRF_TRUSTED_ORIGINS` avec l'origine frontend personnalisée exacte, protocole inclus :

   ```text
   https://app.mon-carnet.ci
   ```

8. Garder `SESSION_COOKIE_SAMESITE=None` et `CSRF_COOKIE_SAMESITE=None` (cookies Secure), mais laisser `SESSION_COOKIE_DOMAIN` et `CSRF_COOKIE_DOMAIN` vides pour conserver des cookies host-only sur `api.`.
9. Définir dans Vercel `NEXT_PUBLIC_API_URL=https://api.mon-carnet.ci`, puis redéployer le frontend.
10. Configurer SMTP avant de tester les invitations établissement.
11. Enregistrer OAuth avec le callback `https://api.mon-carnet.ci/api/v1/identity/oauth/<fournisseur>/callback/` chez chaque fournisseur.

### Configuration Docker Render

Dans Render, sélectionner le Blueprint depuis la racine du dépôt. Le Dockerfile lance `manage.py migrate --noinput`, puis Gunicorn sur le port `$PORT` fourni par Render. Ne pas saisir de Build Command ni de Start Command Python qui remplaceraient la configuration du conteneur.

Le plan gratuit Render peut se mettre en veille. C’est acceptable pour une V1 de démonstration, pas pour une promesse de disponibilité médicale 24/7.

## 4. Configuration Vercel — frontend Next.js

Créer un projet Vercel lié au même dépôt :

- Framework : **Next.js** ;
- Root Directory : `.` si Vercel utilise le workspace racine ;
- Install Command : `npm ci` ;
- Build Command : `npm run build` ;
- variable `NEXT_PUBLIC_API_URL` : URL HTTPS personnalisée de l’API, par exemple `https://api.mon-carnet.ci` (pas l’URL `onrender.com`) ;
- ne jamais mettre de secret backend dans une variable `NEXT_PUBLIC_*`.

Si le projet Vercel impose le dossier applicatif comme Root Directory, conserver l’installation depuis la racine du monorepo ou utiliser la configuration monorepo recommandée par Vercel : le lockfile de référence est le `package-lock.json` racine.

Après déploiement, vérifier :

```text
https://<frontend-vercel>/
https://<frontend-vercel>/connexion
https://<frontend-vercel>/securite
```

Puis vérifier que l’appel navigateur vers l’API passe bien en HTTPS avec cookies et CSRF.

## 5. Variables d’environnement

Le fichier [`.env.example`](../.env.example) contient les noms locaux, sans secret réel. [`apps/web/.env.production.example`](../apps/web/.env.production.example) documente les seules variables publiques frontend à saisir aussi dans Vercel ; le fichier local `apps/web/.env.production.local` est ignoré par Git. `NEXT_PUBLIC_*` est intégré au JavaScript envoyé au navigateur : n’y placer aucun secret. [`apps/api/.env.production.example`](../apps/api/.env.production.example) aide à configurer Render : le conteneur ne charge pas ce fichier automatiquement. Pour le pilote sur les URL actuelles, l’origine web est `https://e-carnetci.vercel.app` et l’API est `https://ecarnet-api.onrender.com`. Saisir `DATABASE_URL`, `DJANGO_SECRET_KEY`, les mots de passe SMTP et les identifiants OAuth uniquement dans les variables sécurisées de Render.

Pour les métadonnées canoniques, les cartes de partage et le sitemap, définir `NEXT_PUBLIC_SITE_URL` dans Vercel sur l’origine publique stable du frontend (actuellement l’URL pilote documentée ci-dessus). Remplacer cette valeur par le domaine personnalisé du projet lorsqu’il sera configuré, puis redéployer le frontend. Le fichier `apps/web/public/llms.txt` contient aussi l’URL pilote : mettre à jour ses liens lors du changement de domaine.

### Variables indispensables en production API

| Variable | Valeur attendue |
|---|---|
| `DJANGO_DEBUG` | `false` |
| `DJANGO_SECRET_KEY` | secret aléatoire long, généré par Render ou gestionnaire de secrets |
| `DJANGO_ALLOWED_HOSTS` | hostnames API sans `https://` |
| `DATABASE_URL` | URL PostgreSQL Neon avec TLS |
| `WEB_ORIGIN` | origine frontend HTTPS exacte |
| `CORS_ALLOWED_ORIGINS` | même origine, éventuellement liste séparée par virgules |
| `CSRF_TRUSTED_ORIGINS` | mêmes origines HTTPS autorisées |
| `SESSION_COOKIE_SAMESITE` | `None` avec `Secure` (notamment pour le callback OAuth Apple) ; utiliser les domaines personnalisés same-site `app.` et `api.` |
| `SESSION_COOKIE_DOMAIN` | vide : cookie host-only sur l'API, ne pas partager avec tous les sous-domaines |
| `NEXT_PUBLIC_API_URL` (Vercel) | `https://api.<votre-domaine>` |
| `EMAIL_*` | SMTP réel et vérifié |
| `DEFAULT_FROM_EMAIL` | adresse d’envoi sur domaine contrôlé |
| `ECARNET_INVITATION_BASE_URL` | URL frontend `/etablissement/activation` |
| `ECARNET_QR_TTL_SECONDS` | `300` pour 5 minutes en V1 |

### Règles impératives

- `.env`, clés Apple `.p8`, secrets OAuth et mots de passe ne doivent pas entrer dans Git.
- `NEXT_PUBLIC_*` est public par conception.
- Ne pas réutiliser la base Neon de production pour les tests.
- Ne pas mettre les données médicales en cache dans le service worker.
- Après toute modification de domaine, revoir CORS, CSRF, cookies et callbacks OAuth ensemble.

## 6. Base Neon

Créer une base dédiée au minimum pour staging et une autre pour production. Utiliser PostgreSQL réel avant de déclarer la V1 prête :

```bash
cd apps/api
python manage.py check --deploy
python manage.py migrate --plan
python manage.py migrate --noinput
python manage.py showmigrations
```

Le test de readiness est :

```bash
curl -fsS https://<api-render>/api/v1/health/ready/
```

La réponse attendue est un JSON `{"status":"ready"}` avec HTTP 200.

Avant toute donnée réelle :

- tester le trigger append-only de l’audit ;
- vérifier l’isolation entre établissements A/B ;
- vérifier les permissions PostgreSQL ;
- produire une sauvegarde ;
- restaurer dans une base isolée ;
- mesurer et approuver RPO/RTO.

## 7. Checklist Go/No-Go V1

### Déploiement technique

- [ ] `npm ci` réussi depuis la racine.
- [ ] `npm run lint` réussi.
- [ ] `npm run build` réussi.
- [ ] `npm run test:api` réussi.
- [ ] `npm run check:api` réussi.
- [ ] `makemigrations --check --dry-run` sans migration manquante.
- [ ] Render répond sur live et ready.
- [ ] Frontend `app.<domaine>` appelle l’API `api.<domaine>` en HTTPS ; les domaines `vercel.app`/`onrender.com` ne servent pas au parcours utilisateur.
- [ ] Cookies de session host-only et CSRF vérifiés dans Safari/iOS sur les vrais domaines personnalisés.
- [ ] PostgreSQL Neon de staging testé (les tests PostgreSQL 16 locaux du 08/10 ne remplacent pas cette recette).

### Fonctionnel et sécurité — bloquants connus du dépôt

- [ ] SMTP réel configuré et invitation reçue.
- [ ] Aucun jeton brut dans une réponse API, y compris en debug.
- [ ] QR 5 minutes testé sur mobile réel.
- [ ] OAuth réel testé, ou boutons désactivés tant que non configuré.
- [ ] Audit npm daté exécuté ; les 5 alertes `high` signalées le 05/10 sont historiques et leur état actuel doit être vérifié.
- [ ] `authlib.jose` migré vers `joserfc` ou décision documentée.
- [ ] Sanitation SVG retestée sur staging.
- [ ] Sauvegarde/restauration de la cible managée prouvée et RPO/RTO opérationnel mesuré (le smoke local du 08/10 n’est pas cette preuve).
- [ ] Console staff durcie et accès établissement vérifié.
- [ ] Validation médicale et juridique signée.

**Tant que ces cases ne sont pas validées, utiliser seulement des données fictives (`example.test`).** Le déploiement Vercel/Render/Neon peut être fait pour le pilote technique, mais il ne constitue pas à lui seul l’autorisation d’exploiter des données de santé réelles.

## 8. Plan de migration VPS éventuelle après V2

1. Garder les mêmes images et variables d’environnement.
2. Provisionner un VPS Ubuntu LTS dimensionné au minimum à 4 vCPU / 8 Go RAM selon charge mesurée.
3. Installer Docker, firewall, utilisateur non-root, clés SSH, mises à jour et sauvegardes hors machine.
4. Déployer Caddy/Nginx, web, API, PostgreSQL et éventuellement Redis via Compose.
5. Restaurer une copie anonymisée ou synthétique de staging.
6. Pointer temporairement un sous-domaine staging vers le VPS.
7. Exécuter la même recette CA-01 à CA-24.
8. Préparer un plan de retour vers Render/Neon.
9. Basculer le DNS avec TTL réduit et fenêtre surveillée.
10. Ne supprimer aucun service managé avant d’avoir une restauration testée et une période d’observation validée.

**Conclusion actuelle :**

1. **Maintenant : Vercel + Render + Neon.**
2. **Pendant la V1/V2 : mesurer trafic, latence, CPU/RAM, connexions DB, stockage et facture mensuelle.**
3. **Pas de Redis, Cloudinary ou autre service supplémentaire sans besoin réel.**
4. **Après V2 : réévaluer l’option VPS selon mesures et exigences ; aucun fournisseur n’est retenu.**
5. **La migration doit être réversible et testée avant tout basculement de données réelles.**

L’objectif n’est donc pas de tout centraliser dès maintenant : **on garde une architecture simple, économique et remplaçable, puis on optimise avec des chiffres réels.**

## 9. Option à réévaluer après V2 — Hodi Côte d’Ivoire

**Hodi Côte d’Ivoire — VPS managé** est un candidat à étudier après V2 si les mesures ou exigences le justifient. Ce n’est ni une décision d’hébergement pour la V1/V2, ni une décision d’achat.

### Éléments annoncés par Hodi à vérifier

L’offre managée consultée annonce notamment les éléments suivants, qui restent à confirmer par devis et contrat :

- datacenter Tier III à Grand-Bassam ;
- architecture haute disponibilité N+2 ;
- firewall managé ;
- sauvegarde globale quotidienne avec rétention annoncée de 7 jours ;
- supervision 24/7 ;
- infogérance logicielle ;
- maintien en condition opérationnelle et de sécurité.

Si un VPS est réévalué après V2, demander un devis indicatif (par exemple **4 vCPU / 8 Go RAM / 100 Go SSD minimum**) puis confirmer le dimensionnement après mesures. Il faudra demander séparément la rétention longue, la restauration testée, le RPO/RTO contractuel, les journaux d’accès administrateur et les engagements précis concernant les données de santé.

### Prestataires à comparer (sans classement)

Cette liste est indicative et ne constitue pas une présélection :

- **Hodi Côte d’Ivoire** — comparer les offres managée et non managée, localisation, sauvegardes, supervision et engagements contractuels.
- **Cloudstore Africa / ST Digital** — vérifier l’offre contractuelle, le support, les sauvegardes et la localisation pour la Côte d’Ivoire.
- **Orange Cloud Côte d’Ivoire** — vérifier l’offre retenue, la sauvegarde, l’infogérance et la localisation contractuelle.

Les caractéristiques et tarifs évoluent : ils doivent être reconfirmés par devis avant achat. Les pages consultées sont : [Hodi VPS managé](https://hodi.host/ci/store/serveur-virtuel-manage), [Hodi VPS non managé](https://hodi.host/ci/store/serveur-virtuel), [ST Digital / Cloudstore](https://st.digital/cloud) et [Orange Cloud CI](https://cloud.orange.ci/index.php?rp=/store/serveur-virtuel-dedie&id=1&group=1).

## Options à réévaluer après V2 — aucun hébergeur retenu

**Aucun hébergeur VPS n’est retenu actuellement. Hodi Côte d’Ivoire est une option à réévaluer après V2**, sous réserve de validation technique et contractuelle au moment d’une éventuelle migration.

Les caractéristiques présentées par le fournisseur devront être confirmées au moment d’un éventuel devis. Elles ne constituent ni une recommandation d’achat actuelle ni une validation de conformité.

Exemple de configuration à chiffrer si une migration est décidée : **4 vCPU, 8 Go RAM, 100 Go SSD minimum, Ubuntu LTS, sauvegardes quotidiennes, rétention longue durée et RPO/RTO contractuels**. Le dimensionnement dépendra des mesures V2 ; toute offre reste à vérifier au regard de la localisation, du chiffrement, des accès administrateur, des sauvegardes, de la restauration et des exigences applicables aux données de santé.
