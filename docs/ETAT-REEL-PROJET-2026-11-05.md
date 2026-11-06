> **Référence d’état auditée le 05/11/2026.** L’état courant du code, des tests et de l’exploitation est centralisé dans [`ETAT-REEL-PROJET-2026-11-05.md`](ETAT-REEL-PROJET-2026-11-05.md). Les documents datés conservent leur valeur historique ; leurs affirmations ne remplacent pas le code ni cette référence. Une fonctionnalité présente dans le dépôt n’est pas pour autant déployée, validée en staging ou autorisée pour des données réelles.

# État réel du projet — audit du 5 novembre 2026

## Portée et méthode

Ce document est la référence actuelle de l’état du dépôt. Il est fondé sur l’arborescence, le code, les migrations, les tests présents et les scripts d’exploitation de l’archive auditée le 5 novembre 2026. Un compte rendu daté décrit une photographie historique : il ne doit pas être lu comme une liste de tâches active lorsqu’il contredit ce document ou le code.

L’état « présent dans le dépôt » ne signifie pas « validé en staging », « déployé » ou « autorisé pour des données de santé réelles ». Les secrets, les adresses d’exploitation, les fournisseurs et les preuves de recette restent des paramètres d’environnement hors Git.

## Ce qui est présent dans le code

### API et sécurité

- API Django/DRF structurée en applications `identity`, `patients`, `care`, `establishments`, `professionals`, `referrals` et `audit`.
- Authentification par session, récupération de compte, changement de mot de passe obligatoire lorsque requis et callbacks OAuth Google/Facebook/Apple présents côté code ; les identifiants réels et les essais fournisseurs ne sont pas fournis dans l’archive.
- Contrôles serveur de permissions, cloisonnement des établissements, journalisation des opérations sensibles et migrations d’audit append-only avec protection PostgreSQL contre `TRUNCATE`.
- Données patient : profil titulaire, profils représentés, carte d’urgence, déclarations, contacts de confiance, transferts soumis à vérification et mécanismes d’accès contrôlé.
- Parcours professionnel : profil, spécialités déclaratives, rattachements établissement, demandes d’accès et credentials ; aucun justificatif professionnel n’est collecté automatiquement par le code observé.
- Parcours de soins : pré-consultations, consultations signées, documents, vaccinations avec confirmation professionnelle, mesures de santé structurées, rendez-vous, notifications, rappels, plans de suivi, prescriptions et export XLSX.
- QR d’accès opaque, hashé, à usage unique, durée configurée par défaut à 300 secondes, invalidation des anciens jetons, limitation de création et commande de purge.
- Uploads de documents prévus pour Cloudinary privé en environnement configuré ; le stockage local est conservé pour les tests et les environnements sans configuration. L’URL média publique ne sert pas les documents privés.
- Hors connexion (version 1.5, 05/11/2026) : bandeau « hors connexion / connexion rétablie » dans toute l’application ; le service worker garde la coquille HTML des écrans (sans donnée personnelle) et les pages d’information ; les lectures de l’API des trois espaces sont copiées **chiffrées** sur l’appareil (AES-GCM 256, clé non extractible de l’appareil, noms hachés), en lecture seule, 7 jours pour le patient et 24 heures pour les données de tiers, effacées à la déconnexion, au changement de compte/profil/espace et à la demande ; aucune écriture hors connexion. Les documents (fichiers), jetons, QR, signatures, administration et journal d’audit ne sont jamais copiés. Voir `PWA-HORS-CONNEXION.md`. La clé étant sur l’appareil, ce chiffrement ne suffit pas pour des données de santé réelles (voir `DONNEES-REELLES-DECISION.md`).

### Frontend

- Application Next.js avec pages publiques, connexion/inscription, onboarding, espace patient, espace professionnel, espace établissement, espace staff, urgence, aide, sécurité, confidentialité, CGU et informations légales.
- Fonctionnalités visibles dans les routes et composants : carnet, consultations, documents, vaccinations, mesures, rendez-vous, rappels, plans de suivi, notifications, QR, accès professionnel, adressages, représentations, carte d’urgence, paramètres et console établissement/staff.
- Console « Surveillance technique » présente pour les comptes d’exploitation autorisés : état API/base/cache/stockage local, incidents, accusé de réception et résolution manuelle.
- Le code contient encore des textes et styles issus de plusieurs passes produit ; les fichiers de modifications historiques restent des journaux et ne sont pas une spécification actuelle.

### Exploitation et monitoring

- Endpoints publics : `/api/v1/health/live/` vérifie que le processus répond et `/api/v1/health/ready/` vérifie la connexion base.
- Webhook signé `POST /api/v1/identity/monitoring/webhook/`, horodatage, UUID d’événement, HMAC-SHA256, anti-rejeu, idempotence et audit des ouvertures/résolutions.
- `ops/monitoring-check.sh` contrôle liveness/readiness et, lorsque `ECARNET_MONITOR_REQUIRE_COMPONENTS=true`, la base, le cache, le stockage, la fraîcheur d’une sauvegarde et le port SMTP. Il ouvre/résout un incident stable par composant.
- `ops/monitoring-external-check.sh` est prévu pour une machine ou un service hors hébergeur et ne reçoit pas les accès internes. Les exemples de cron serveur et hors hébergeur sont dans `ops/monitoring-*.example`.
- Les e-mails d’exploitation sont fermés par défaut : `ECARNET_OPERATIONS_ADMIN_EMAILS` est vide dans `.env.example`. Aucun secret réel ni aucune adresse d’exploitation réelle ne sont livrés dans l’archive.
- Sauvegarde/restauration : scripts locaux `ops/backup-db.sh`, `ops/restore-db-test.sh` et `ops/postgres-backup-restore-smoke.sh` présents. Une sauvegarde planifiée et une restauration de la cible managée restent à prouver dans l’environnement retenu.

## Ce qui est vérifié dans cette archive

- Syntaxe Bash des sondes ADM-10.
- `python3 ops/test-monitoring-check.py` : deux scénarios liveness/readiness réussis.
- `python3 ops/test-monitoring-event.py` : signature, refus, mauvais usage et API injoignable vérifiés.
- Simulation locale saine → panne readiness → rétablissement réussie.
- Le ZIP différentiel ADM-10 est testable, mais aucune recette staging réelle n’a été exécutée depuis ce sandbox.

## Ce qui n’est pas démontré par cette archive

- Déploiement effectif sur Hodi, Render, Vercel, Neon ou un autre fournisseur.
- Configuration réelle de `ECARNET_OPERATIONS_ADMIN_EMAILS`, des secrets webhook, du SMTP, de Cloudinary, des OAuth et des domaines HTTPS.
- Exécution de la recette staging ADM-10 avec coupure réelle de base, incident créé/résolu dans l’instance déployée et accusé audité.
- RPO/RTO, sauvegarde externe, restauration de la cible managée, disponibilité, latence et capacité en production.
- Essais mobiles Android/iOS/4G, test navigateur complet, certification WCAG ou validation médicale/juridique.
- Autorisation de traiter des données de santé réelles. Tant que les portes juridiques, médicales, sécurité, exploitation, hébergement et recette ne sont pas signées, utiliser uniquement des données synthétiques (`example.test`).

## Commandes de référence

```bash
# Scripts ADM-10 sans dépendance Django
python3 ops/test-monitoring-check.py
python3 ops/test-monitoring-event.py

# Contrôles de dépôt lorsque les dépendances sont installées
npm run check:api
npm run test:api
npm run test:web
npm run lint
npm run build
```

Dans le sandbox audité, la suite Django n’a pas démarré car le module `django` n’était pas installé. Ce blocage d’environnement ne doit pas être présenté comme un échec fonctionnel du code ni comme une suite verte.

## Règle de mise à jour documentaire

Toute nouvelle preuve de staging ou de production doit préciser l’environnement, la date, le commit ou l’artefact, les données utilisées et les résultats. Elle doit mettre à jour ce document et le document opérationnel concerné ; elle ne doit pas transformer un résultat local en validation de production.
