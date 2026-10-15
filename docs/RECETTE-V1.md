# Recette V1 — matrice CA-01 à CA-24

**État revu : 08/10/2026.** La V1 n’est pas acceptée. Ce document sépare le code présent, les preuves locales et les validations staging/terrain non exécutées. Les parcours suivent les décisions actives de [la roadmap](ROADMAP-V1-V5.md), pas les anciens flows des prototypes ou des audits historiques.

**Données de recette :** comptes, dossiers, identifiants, justificatifs et événements entièrement fictifs (`example.test`). Aucune donnée réelle.

## Matrice

| ID | Critère | État du dépôt | À faire / preuve manquante |
|---|---|---|---|
| CA-01 | Identité unique et méthodes sans doublon | **Présent localement.** Argon2id, `AuthIdentity`, callbacks, retour UI, liaison/déliaison, audit, unicité provider+ID et conflit e-mail sans fusion. | Credentials OAuth réels et tests bout en bout. OTP SMS est reporté en V3. |
| CA-02 | Établissement demande par e-mail | **Partiel.** La route publique de création est neutralisée (`403`) et l’UI indique le contact e-mail. | Formaliser l’adresse officielle, la réception/examen hors application et la politique de rétention des preuves. |
| CA-03 | Staff vérifie la structure et crée l’accès | **Présent côté API/UI.** Routes staff protégées, entité stable et administrateur nominatif historisé. | Recetter permission staff, remplacement admin, audit et staging. |
| CA-04 | Invitation sécurisée au responsable établissement | **Présent côté API/UI.** Jeton hashé, usage unique, expiration 48 h ; jeton absent des réponses API ; e-mail envoyé par SMTP configurable ; tests locaux. | Fournisseur SMTP réel, renvoi/révocation et délivrabilité à recetter en staging. |
| CA-05 | Code médecin crée une demande, établissement décide | **Présent côté API/UI.** Code hashé, usage unique, expiration 48 h ; saisie atomique → `pending` ; acceptation/refus par l’administrateur établissement. La preuve PostgreSQL locale couvre les transitions ciblées. | Rejouer sur la cible de staging ; recetter expiration, révocation/renvoi, audit et UX mobile. |
| CA-06 | Professionnel choisit établissement actif | **Présent côté API.** Membership active et structure active vérifiées. | Recette multi-établissement/staging et UX mobile. |
| CA-07 | Patient saisit pré-consultation, aide sans compte infirmier | **Socle présent.** Saisie dans compte patient et champ d’aide non authentifié; aucun rôle infirmier autonome. | Valider champs médicaux et essai mobile/clavier/réseau lent. |
| CA-08 | Clôture et correction traçable | **Partiel.** Clôture idempotente et snapshot/audit; édition après clôture refusée. | Addendum de correction post-clôture à finaliser et valider médicalement. |
| CA-09 | Demande d’accès in-app ou QR sans lecture avant consentement | **Présent côté API/UI, recette réelle à faire.** Génération QR patient, scan/saisie du jeton côté professionnel ; jeton opaque, hashé, usage unique verrouillé, 300 s, anciens QR invalidés, création limitée, purge planifiée. L’API exige le QR et ne renvoie plus `patient_id` au professionnel. | Recette mobile/staging ; concurrence à rejouer sur PostgreSQL ; délai d’attente après révocation/expiration à décider. |
| CA-10 | Patient voit professionnel, établissement, scopes, durée et consent | **Présent localement.** Accept/refus contrôlés serveur; historique visible; scopes A9 et durée 5 min exposés. Demande en attente limitée à 7 jours; nouvelle demande après refus bloquée 30 jours. | Tester compréhension/labels sur mobile staging. |
| CA-11 | Expiration AccessGrant à 2 h côté serveur | **Couvert par tests du dépôt.** | Recette à rejouer sur staging/PostgreSQL et horloge contrôlée. |
| CA-12 | Deux prolongations d’une heure, troisième refusée | **Couvert par tests du dépôt.** | Vérifier rendu et échéance sur mobile/staging. |
| CA-13 | Révocation immédiate | **Corrigé et testé localement sur PostgreSQL 16.** Les transitions accept/extend/revoke verrouillent la ligne; `revoke` reste terminal en concurrence. | Rejouer sur staging et vérifier la topologie de connexions réelle. |
| CA-14 | Professionnel retrouve la pré-consultation autorisée | **Couvert par tests backend.** | Recette UI complète avec scope final et consentement. |
| CA-15 | Consultation, auteur et établissement imposés serveur | **Socle testé.** Consultation persistée; auteur/structure pris du contexte serveur. | Champs médicaux A10 et recette complète staging restent. |
| CA-16 | Consultation visible dans carnet avec provenance | **Socle présent/testé.** | Vérifier lisibilité et flux bout en bout mobile. |
| CA-17 | Attestation médicale protégée et tracée | **Présent localement.** SVG parsé et sanitationné par allowlist stricte ; hash SHA-256, horodatage et tests script/CSS/URL/DTD intégrés. | Rejouer le sanitizer strict en staging et vérifier le rendu de stockage; le workflow clinique exact reste à valider. |
| CA-18 | Événements sensibles audités et immuables | **Présent côté code.** Les lectures cliniques sont journalisées; triggers PostgreSQL bloquent UPDATE/DELETE/TRUNCATE; CA‑13 est atomique. | Rejouer les triggers et les privilèges runtime sur l’instance cible. |
| CA-19 | Isolation entre établissements | **Corrigé et testé localement sur PostgreSQL 16.** Pré-consultation rattachée au site, filtre identique au grant, refus d’une source de consultation inter-site et lecture auditée. | Rejouer la matrice A/B en staging; les entrées historiques sans site restent fail closed. |
| CA-20 | Fin de rattachement par l’établissement ou le médecin, conservation des traces et dossiers | **Présent localement.** Les deux côtés peuvent y mettre fin ; état `terminated`, accès futur bloqué, relation/dossiers non supprimés, événement d’audit distinct ; tests ciblés. | Recette UX/permissions sur staging et validation juridique de la durée de conservation. |
| CA-21 | Pas d’accès clinique avant rattachement, établissement et consentement | **Contrôles backend présents** : contexte professionnel, établissement/membership actifs et AccessGrant patient consenti. TOTP reste V3 et n’est pas exigé. | Vérifier sur PostgreSQL/staging que l’espace établissement ne peut pas lire les dossiers. |
| CA-22 | Restauration PostgreSQL et RPO/RTO | **Smoke PostgreSQL 16 local démontré le 08/10/2026** : sauvegarde custom, SHA-256, restauration isolée, marqueur et 40 migrations vérifiés ; commande de restauration en 1 s. | RPO non mesuré ; 1 s ne mesure que la commande locale, pas la reprise du service. Rejouer sur Neon/staging avec sauvegardes planifiées et approuver RPO/RTO avant exploitation. Voir [rapport](../reports/postgres-restore-20261008T081823Z.txt). |
| CA-23 | Parcours mobile/ordinateur et accessibilité | **Smoke Chromium local rapporté le 05/10** sur 6 routes : landmark `<main>`, langue française et `alt`. Ce n’est pas un parcours authentifié avec API ni une certification WCAG. | Android réel/4G, OAuth/onboarding/QR, lecteurs d’écran et essais terrain; icônes/composition mobile à aligner. |
| CA-24 | Aucun compte/écran/endpoint infirmier autonome | **Conforme dans le code inspecté.** | Maintenir tests de non-régression. |

## Contrôles locaux consignés le 05/10/2026

```bash
npm ci
npm run test:api
npm run check:api
(cd apps/api && .venv/bin/python manage.py makemigrations --check --dry-run)
npm run lint
npm run build
```

Résultats consignés à cette date : **57 tests Django OK et 1 ignoré** sous SQLite, check sans erreur, aucune migration manquante, lint sans erreur, build Next.js avec **27 routes** ; smoke Chromium local sur 6 routes. `npm ci` signalait alors 5 vulnérabilités `high` dans l’arbre d’outillage et `authlib.jose` une dépréciation. Ce sont des résultats historiques : l’état actuel des alertes n’a pas été revérifié.

## Preuve PostgreSQL locale du 08/10/2026

La suite Django a été exécutée sur PostgreSQL 16 local le 08/10/2026 : **77 tests réussis, aucun échec et aucun ignoré**, dont consommation concurrente de code médecin, consentement versionné, fin de rattachement des deux côtés et invitation sans jeton retourné par l’API. Rapport : [preuve de tests PostgreSQL](../reports/postgres-tests-20261008.txt). Un smoke sauvegarde/restauration distinct a créé une archive PostgreSQL custom (212 757 octets), vérifié SHA-256, restauré une base isolée (`ecarnet_restore_20261008T081823Z`), puis validé le marqueur synthétique et 40 lignes de migrations. La commande de restauration a pris 1 s. Rapport : [preuve de restauration](../reports/postgres-restore-20261008T081823Z.txt) ; script : [ops/postgres-backup-restore-smoke.sh](../ops/postgres-backup-restore-smoke.sh).

Ce smoke-test n’est pas un plan de reprise en production : les données sont synthétiques, le service n’a pas été redémarré depuis un incident, et ni la cadence de sauvegarde réelle, ni le RPO, ni le RTO opérationnel ne sont mesurés. Il faut exécuter la même recette avec le service PostgreSQL de staging et ses sauvegardes configurées, sans base de production.

## Décisions toujours bloquantes

- A9 : décision appliquée localement (QR 5 min ; pré-consultation + déclarations par défaut ; consultations sélectionnable ; documents hors V1) ; recetter l’UX mobile.
- A8/A10 : validation médicale des champs, unités et corrections.
- A11–A16 : rétention des preuves structure reçues par e-mail, stockage, conservation, droit local, incidents et hébergement. Aucun justificatif personnel médecin dans E‑Carnet. Décision d’infrastructure actuelle : Vercel + Render + Neon pour V1/V2 ; VPS seulement à réévaluer après V2.
- Tests requis avant staging : invitation 48 h/usage unique, code 48 h/usage unique, rejeu/concurrence sur le service cible, refus, remplacement admin, historique conservé, absence d’accès clinique établissement, protection audit TRUNCATE.

La V1 ne doit pas être déclarée terminée tant que CA-01 à CA-24 n’ont pas de preuves staging/mobile/ordinateur et que les validations professionnelles/médico-juridiques applicables ne sont pas documentées.


## Couverture spécialisée à ajouter

Les tests ciblés OAuth fournisseur réel, concurrence QR PostgreSQL et recette de rendu staging restent à exécuter. Les charges SVG hostiles sont maintenant couvertes localement par les tests de sanitation.
