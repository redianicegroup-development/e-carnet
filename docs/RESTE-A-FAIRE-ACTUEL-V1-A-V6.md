> **Référence d’état auditée le 06/11/2026.** L’état courant du code, des tests et de l’exploitation est centralisé dans [`ETAT-REEL-PROJET-2026-11-06.md`](ETAT-REEL-PROJET-2026-11-06.md). Les documents datés conservent leur valeur historique ; leurs affirmations ne remplacent pas le code ni cette référence. Une fonctionnalité présente dans le dépôt n’est pas pour autant déployée, validée en staging ou autorisée pour des données réelles.

# Mon E-Carnet — Reste à faire réel et feuille de route V1 à V6

**Document de référence : 31 octobre 2026** (remplace la version du 29 octobre)  
**Source principale :** code de l'archive e-carnet **v1.4-final** (31/10/2026) : `apps/api`, `apps/web`, migrations, tests, CI et documentation technique. Le cahier des charges v13 (`docs/.cdc/`) détaille chaque fonction (122 suivies).  
**Statut global :** V1 fonctionnelle en local, mais non validée pour des données de santé réelles.

> **Mise à jour du 02/11/2026 — hors connexion.** Livré : copie des déclarations en lecture seule (profil actif et profils enfants déjà ouverts, changement de profil sans réseau, 7 jours, effacée à la déconnexion, réglage *Paramètres › Hors connexion*) ; copies de carte d'urgence qui expirent et disparaissent vraiment (24 h, 404/410) ; rechargement hors ligne de `/urgence/<jeton>` ; désabonnement push à la déconnexion ; textes d'information ; 40 tests. **Reste** : revue juridique, analyse de menace et décision signée avant publication (PAT-22) ; recette sur téléphones réels (mode avion, iOS PWA installée, Android) ; statut « confirmé » des déclarations par un professionnel (n'existe pas dans l'API) ; vaccinations hors connexion si souhaité ; écriture et synchro hors connexion et chiffrement local : toujours sur décision.

> **Mise à jour du 04/11/2026 — sécurité et données réelles.** Livré : Next.js 16.4.4 et `cryptography` 50.0.0 ; export Excel réparé (`URL_FORMAT_OVERRIDE: None`) ; ouverture de dossier par l’administrateur limitée à 30 minutes (jamais illimitée, 4 h au plus), anciennes ouvertures sans échéance refusées, lecture clinique désactivée par défaut ; FAQ, Aide, politique de confidentialité et `/v1` alignées sur le NO-GO (données fictives) depuis un interrupteur unique ; document `docs/DONNEES-REELLES-DECISION.md`. Décision : pas de double authentification pour l’équipe ni pour les professionnels pour le moment. **Reste, avant tout Go données réelles :** question ouverte « des données réelles ont-elles déjà été saisies ? » ; copie hors connexion (désactivée par défaut ou chiffrée avec un code choisi par la personne) ; documents médicaux chez Cloudinary ; `zod` < 4.6.6 ; migration `0025` (`FollowUpPlan.objective`) ; écran d’ouverture de dossier si la lecture est activée ; restauration réelle, hébergement, validations juridique/médicale, ARTCI, recette signée.

> **Mise à jour du 05/11/2026 — PRO-13.** Livré localement : bloc médecin « Ajouter une mesure » dans la pré-consultation, lecture et création limitées à l’autorisation active et à l’établissement, provenance visible dans les deux espaces, audit et refus de l’auto-accès. Le NO-GO données réelles reste inchangé ; la recette staging est à faire. Les 4 tests web PRO-13 passent et le typecheck complet est vert. La suite web compte 289 réussis sur 296 ; ses 7 échecs sont identiques à ceux vérifiés sur l’archive originale (285/292), donc antérieurs à PRO-13. La syntaxe Python est vérifiée ; les tests Django n’ont pas pu être exécutés dans l’environnement sans Django.


> Chaque ligne a été contrôlée contre le code de la v1.4-final ; les tests, le lint et le build n'ont pas été rejoués pour cette mise à jour. Ce document remplace les anciennes listes qui décrivaient encore comme « à faire » plusieurs fonctions déjà présentes dans le code. Une fonction marquée **Livré localement** existe dans l’API et/ou l’interface, mais peut encore nécessiter une recette staging, mobile, juridique ou médicale.

## Légende

- **Livré localement** : route, modèle ou interface présente et contrôlée localement.
- **Partiel** : une partie existe, mais il manque une étape fonctionnelle, une interface, une intégration ou une décision.
- **À recetter** : le code est présent ; il reste à le vérifier sur l’environnement cible, sur de vrais appareils ou avec des utilisateurs.
- **À décider** : aucune implémentation ne doit commencer avant une décision produit, médicale, juridique ou de sécurité.
- **Non commencé** : absent ou seulement évoqué dans les documents.
- **Bloquant V1** : empêche d’autoriser le traitement de données réelles.

---

## 1. Ce qui est réellement déjà livré dans le dépôt

### Identité et espaces

- Compte unique, session serveur, CSRF, cookies protégés hors debug et Argon2id.
- Inscription et connexion e-mail/mot de passe.
- Choix de contexte Patient ou Professionnel.
- Onboarding identité, profil patient, profil professionnel, sécurité et question de récupération complémentaire.
- OAuth Google, Facebook et Apple : endpoints, callbacks, liaison/déliaison et audit présents ; Facebook et Apple n'apparaissent que s'ils sont configurés ; configuration réelle encore à recetter.
- Récupération de compte par question secrète en deux étapes : la bonne réponse suffit tant que l'OTP n'existe pas.
- Thèmes, palettes, paires de polices et tailles de texte persistés par compte.
- Demande de suppression/suspension de compte et traitement administrateur présents.

### Patient et carnet

- Déclarations de santé avec provenance.
- Pré-consultation en brouillon, modification et clôture par le professionnel.
- Consultations signées, historique, constantes, ordonnance structurée et examens demandés.
- Vaccinations : ajout patient et confirmation professionnelle.
- Mesures de santé : saisie et lecture autorisées ; écran médecin PRO-13, avec provenance et contrôle de l’autorisation active (livré localement le 05/11/2026, recette staging à faire).
- Documents médicaux : dépôt patient, téléchargement contrôlé et lecture professionnelle selon périmètre.
- Plans de suivi : écran médecin avec objectif, statut et historique des révisions (v1.3), lecture patient.
- Rappels de médicaments et confirmations de prise : jours de la semaine, dates de début et de fin, stock et seuil, rappel de renouvellement 3 jours avant la fin (v1.4).
- Rendez-vous : côté patient seulement ; le patient ne choisit ni professionnel ni établissement ; rien côté professionnel.
- Pages Historique et « Proches et enfants », écran Consultations en deux étapes, nouvelle navigation (v1.3 et v1.4).
- Notifications applicatives et boîte de notifications.
- Export du carnet en PDF ou en Excel par période, volontaire et journalisé, jamais mis en cache.
- PDF d’ordonnance signé avec modèle d’établissement quand il est disponible.

### Accès et sécurité métier

- QR professionnel opaque, à usage unique, valable cinq minutes et consommé atomiquement.
- AccessGrant : demande, consentement, refus, expiration de deux heures, deux prolongations d’une heure et révocation.
- Scopes `preconsultation`, `declarations`, `consultations`, `documents` et `care_history` avec contrôle serveur.
- Journal patient des accès, avec ressource et quantité, sans contenu médical dans les métadonnées.
- Proche de confiance (désactivé par défaut) : compte séparé, mot de rattachement à usage unique, sélection d’un carnet, lecture seule de la fiche d’urgence et révocation.
- Adressage C1 (désactivé par défaut) : proposition, consentement granulaire patient, inbox destinataire, ouverture explicite et snapshot.
- C2 : lecture de l’historique validé provenant de structures sources choisies par le patient, sans copie conservée en V1.
- Carte d’urgence publique, QR distinct, activation/désactivation, appel du contact et limitation par IP ; aucune alerte au patient (supprimée par décision en v1.3) ; copie de la carte ouverte conservée 24 heures dans le navigateur.
- ~~Carte hors ligne/exportable distincte du QR public.~~ Retirée du code le 16/10/2026 (CDC ACS-10) ; remplacée par la copie de 24 h de la carte ouverte par QR et par la copie des déclarations en lecture seule (02/11/2026).
- Représentation d’un enfant mineur et transfert encadré vers le compte adulte via revue staff.

### Établissement et exploitation métier

- Création staff et validation d’un établissement privé.
- Administrateur nominatif historisé, invitation et remplacement.
- Code médecin à usage unique, demande de rattachement `pending`, acceptation/refus, départ et suspension.
- Liste établissement sans contenu clinique.
- Ouverture d’un dossier de sa structure par l’administrateur : motif obligatoire (huit motifs dont Urgence), audit et notification patient ; **API seulement, aucun écran** ; **durée sans limite par défaut** depuis la v1.4 ; lecture clinique activée par défaut (coupure possible). *(Corrigé le 04/11/2026 : 30 minutes par défaut, lecture désactivée par défaut ; toujours aucun écran.)*
- Un seul administrateur actif par établissement : une nouvelle invitation le remplace après confirmation.
- Journal staff des événements établissement ; journal d’audit complet consultable et exportable en CSV par les comptes d’exploitation (v1.3) ; liste d’e-mails d’exploitation fermée par défaut.
- Modèle de pré-consultation établissement.
- Catalogue d’établissements et fiche établissement.

### Qualité : ce qui est prouvé et ce qui ne l'est pas

- Tests API : **492 réussis, rejoués le 04/11/2026** (SQLite, variables de la CI) sur le code corrigé (Next.js 16.4.4, `cryptography` 50.0.0, ouverture de dossier à 30 minutes, export Excel réparé).
- Tests web : **296 écrits, 289 réussis, 7 échecs préexistants** ; comparaison directe avec l'archive originale : même liste d'échecs (285/292 avant le lot, 289/296 après ajout des 4 tests PRO-13 ; tous les tests PRO-13 passent). Typecheck complet vert (05/11/2026).
- Audit automatisé d'accessibilité (axe) : 0 violation sur 10 routes locales (29/10).
- Intégration continue : workflow `.github/workflows/ci.yml` écrit (API sur PostgreSQL 16 avec `makemigrations --check`, tests et sonde de surveillance ; web avec lint, typecheck, tests, build et e2e Playwright) ; **jamais exécuté**.
- `manage.py check` : sans erreur (04/11/2026). **`makemigrations --check` échoue** : migration `0025` manquante pour `FollowUpPlan.objective`, alors que la CI le lance. Lint et build : non rejoués (polices Google inaccessibles dans l'environnement de test).
- PostgreSQL 16 : 77 tests réussis le 08/10, antérieurs aux évolutions.
- Sauvegarde et restauration : test local seulement.

---

# V1 — Finaliser, sécuriser et autoriser le socle

**Objectif :** obtenir une V1 techniquement recettée, juridiquement cadrée et prête pour un pilote fictif contrôlé. La V1 ne doit pas recevoir de données réelles avant la validation formelle.

## V1.1 — Bloquants de recette et de déploiement

| Priorité | Travail restant | État | Critère de sortie |
|---|---|---|---|
| P0 | Déployer un staging séparé avec données fictives | Non commencé ; `ops/staging-gates.sh` décrit les portes à passer | URL, secrets séparés, base séparée et procédure de restauration documentée |
| P0 | Rejouer les tests API sur PostgreSQL de staging | À recetter ; la CI prévoit PostgreSQL 16 mais n'a jamais tourné | Suite backend, concurrence QR, isolation A/B, révocation et permissions vertes |
| P0 | Configurer SMTP réel | Partiel | SPF, DKIM, DMARC, délivrabilité, expiration, renvoi et non-exposition des secrets vérifiés |
| P0 | Vérifier stockage privé des fichiers | Partiel | Documents, avatars, logos, cachets et signatures ne sont jamais publics par défaut |
| P0 | Sauvegardes et restauration | Partiel | Sauvegarde planifiée, restauration testée, RPO/RTO mesurés et approuvés |
| P0 | Sécurité base de données | Partiel | Permissions runtime, append-only, interdiction `TRUNCATE` et migrations vérifiées sur la cible |
| P0 | Secrets et archives | À faire : `apps/api/.env` (4 006 octets), `apps/web/.env.production.local`, `db.sqlite3`, 5 PDF de test et des fichiers de travail (`Fichier.txt`, `jj`, `push-web.patch`, `phase2-celery/`, `akatech-v3.1.zip`) sont toujours dans l'archive | Aucun `.env`, secret ou `db.sqlite3` sensible dans les archives livrées ; secrets historiques renouvelés |
| P0 | Textes publics : la FAQ, l'accueil et la confidentialité disent que de vraies données de santé peuvent être saisies | À corriger | Textes alignés sur le NO-GO ; confirmation écrite qu'aucune donnée réelle n'a été saisie sur l'environnement déployé |
| P0 | Règle d'ouverture de dossier par l'administrateur d'établissement | À décider | Durée (sans limite par défaut aujourd'hui), motif Urgence, lecture clinique activée par défaut, base légale A8, information des patients, écran ou retrait de la fonction | *(04/11/2026 : durée de 30 minutes et lecture désactivée par défaut appliquées ; restent la base légale A8, l'information des patients et l'écran.)*
| P1 | Exécuter la CI écrite et corriger ses échecs, dont les 6 tests web | À faire | CI verte sur PostgreSQL 16 : tests API, lint, typage, build, tests web et e2e |
| P0 | Go/No-Go données réelles | À décider | Validation écrite produit, médicale, juridique, sécurité et hébergement |

## V1.2 — Recette des parcours existants

- Recetter l’inscription, l’onboarding Patient/Professionnel et la reprise après interruption.
- Configurer et tester OAuth Google, Facebook et Apple avec vrais callbacks de staging.
- Tester le QR sur Android et iPhone : permission caméra, saisie manuelle de secours, expiration et QR déjà consommé.
- Recetter le consentement : périmètre affiché, exclusions, durée, refus, prolongation et révocation.
- Recetter le proche de confiance : génération, remise manuelle du mot, consommation unique, sélection, lecture limitée et retrait immédiat.
- Recetter C1/C2 : consentement granulaire, choix des structures sources, ouverture destinataire, lecture seule, audit et expiration.
- Recetter l’ouverture établissement : liste sans contenu, motif obligatoire (dont Urgence), durée (sans limite par défaut), notification patient et absence d’accès inter-établissements ; l'écran d'ouverture n'existe pas encore. *(Durée par défaut : 30 minutes depuis le 04/11/2026.)*
- Recetter l'export du carnet en PDF et en Excel par période, et le journal d'audit consultable et exportable par l'équipe. *(L'export Excel répondait 404 jusqu'au 04/11/2026 : corrigé, à recetter.)*
- Tester sur téléphones réels (Android, iOS avec PWA installée) : carte d'urgence publique et rechargement de `/urgence/<jeton>` en mode avion, papier, réseau lent ; déclarations hors connexion, changement de profil enfant, effacement à la déconnexion.
- Vérifier que le service worker et les caches ne stockent aucune donnée clinique privée, hors la copie de carte d'urgence de 24 heures et la copie des déclarations en lecture seule de 7 jours décrites dans `docs/PWA-HORS-CONNEXION.md`.
- Rejouer les tests de sanitation SVG et le rendu du cachet/signature sur staging.

## V1.3 — Sécurité, accessibilité et expérience

- Corriger les 6 tests web en échec (aide, rattachement médecin, QR visite, schémas, stockage local, cache de thème), puis rejouer la suite complète.
- Exécuter la CI déjà écrite (`.github/workflows/ci.yml`) et corriger ses échecs : lint, typecheck, build, tests web, e2e Playwright, tests Django sur PostgreSQL 16 et `makemigrations --check`.
- Mettre en place une surveillance sans contenu médical : erreurs frontend/backend, disponibilité, échec SMTP et tâches de nettoyage. Les scripts `ops/monitoring-check.sh`, `ops/monitoring-external-check.sh` et `ops/send-monitoring-event.py` sont livrés, avec cron exemples, webhook anti-rejeu et runbook. Il reste à installer les sondes, renseigner les secrets/destinataires et produire la preuve de recette staging ; la mémoire des événements est assurée par `MonitoringWebhookEvent`.
- Auditer les dépendances actuelles et traiter les alertes ; migrer `authlib.jose` vers `joserfc` ou documenter la décision.
- Vérifier rate limiting, cookies, CSRF, domaines réels, headers, cache et absence de secrets dans le navigateur.
- Audit WCAG 2.2 AA manuel restant : clavier, lecteur d’écran, focus, zoom 200 %, reflow 320 px, erreurs et annonces d’état ; l’audit axe automatisé passe à 0 violation sur 10 routes locales.
- Tester cinq profils utilisateurs sur mobile et 4G, dont personne âgée, professionnel pressé et utilisateur peu à l’aise avec l’écrit ; protocole préparé, sessions réelles encore à organiser.
- Exécuter la matrice Android/iOS/navigateurs et consigner les résultats ; matrice préparée dans `docs/P2-RECETTE-MOBILE-WCAG-CHARGE.md`.
- Vérifier après déploiement les images critiques et le LCP ; les deux images hero WebP ont été recompressées localement.

## V1.4 — Décisions juridiques et médicales

- Compléter les champs légaux : exploitant, adresse, base/condition juridique, hébergeurs, régions, sous-traitants et contacts.
- Fixer les durées de conservation, rectification, export, suppression, audit, notifications et pièces reçues par e-mail.
- Décider le statut et la conservation du cookie de mesure des visites.
- Valider le vocabulaire « vérifié », « signé », « audit append-only », « révocable » et « aucune donnée réelle ».
- Faire valider les champs, unités, bornes et corrections des constantes, pré-consultations, consultations et vaccinations par un référent médical.
- Faire valider les conditions de rattachement professionnel et les règles de proche de confiance.
- Obtenir l’avis juridique ivoirien et confirmer les formalités auprès de l’autorité compétente (dossier préparé : ECA-13).
- Trancher la durée de l'ouverture d'un dossier par l'administrateur, le motif « Urgence » et la lecture clinique activée par défaut ; informer les patients (point A8). *(Durée et lecture désactivée par défaut appliquées le 04/11/2026 ; base légale A8 et information des patients restent à trancher.)*
- Informer les patients qu'aucune alerte n'est envoyée quand la carte d'urgence publique est consultée, et décrire la copie de 24 heures dans le navigateur, Cloudinary et les notifications push dans la page de confidentialité.

**Sortie V1 :** pilote fictif possible uniquement après signature des critères de recette. Traitement de données réelles toujours interdit tant que l’hébergement, la conformité et le Go/No-Go ne sont pas validés.

---

# V2 — Prévention et suivi quotidien réellement exploitable

**Objectif :** transformer les briques déjà présentes en parcours de suivi fiables, complets et utiles au patient, sans diagnostic automatique.

## V2.1 — Compléter les fonctions déjà amorcées

- Finaliser la recette staging de l’interface professionnelle des plans de suivi, avec objectifs, fréquence, statut et historique ; l’interface et l’API sont livrées localement.
- Améliorer les graphiques de mesures : tendances, périodes, provenance, unités et absence de fausse alerte.
- Recetter les rappels de médicaments sur téléphones (jours, stock et renouvellement sont livrés) : push, désabonnement à la déconnexion (fait le 02/11/2026, à recetter), tâche toutes les 5 minutes ; écriture et synchro hors connexion seulement après décision.
- Compléter les rendez-vous : le patient doit pouvoir choisir un professionnel ou un établissement ; côté professionnel/établissement, confirmation, déplacement, annulation, rappels et états cohérents (rien n'existe côté professionnel).
- Ajouter les patients récents côté professionnel avec minimisation, durée de conservation et règles de confidentialité.
- ~~Ajouter l’alerte de consultation de la carte d’urgence~~ : **retiré par décision en v1.3** ; ne pas implémenter.
- Ajouter un résumé périodique des accès contrôlable par le patient.
- Compléter l’export du carnet : l'export PDF et Excel par période est livré ; restent le choix par catégorie, l'avertissement, la mention que le fichier téléchargé ne peut pas être révoqué et la documentation de portabilité.
- ~~Ajouter l'écran de saisie de mesures par le médecin~~ : **PRO-13 livré le 05/11/2026** (lecture et création protégées par l'autorisation active, provenance patient/médecin et audit) ; recette staging à faire.
- Ajouter la recherche rapide et les listes denses côté professionnel (rien n'existe).

## V2.2 — Établissements et coordination

- Finaliser la console équipe : remplacement administrateur depuis l’interface, suspension/réactivation, renvoi d’invitation (le journal d'audit consultable et exportable est livré depuis la v1.3).
- Ajouter plusieurs administrateurs par établissement avec rôles précis, sans compte partagé (aujourd'hui une nouvelle invitation remplace l'administrateur actif).
- Compléter les indicateurs établissement sans contenu clinique : le composant de courbes existe ; ajouter les codes actifs et vérifier l'affichage.
- Créer l'écran d'ouverture d'un dossier par l'administrateur avec choix du motif et durée, ou retirer la fonction, selon la décision A8.
- Ajouter les relances internes pour invitation expirée et rattachement en attente.
- Finaliser les modèles de pré-consultation configurables après validation médicale (l'API existe, aucune interface).
- Ajouter un parcours professionnel complet pour les décisions de rattachement et la visibilité limitée des fiches.

## V2.3 — Accessibilité et faible débit

- Mode faible débit : réduction des images, reprise de requêtes, écrans légers et files d’attente explicites.
- Langage simple et pictogrammes validés par des utilisateurs réels.
- Lecture audio des contenus éducatifs après validation des textes et des langues à supporter.
- Notifications applicatives regroupées sans réduire l’audit ni masquer les événements importants.
- PWA installable et parcours de connexion contrôlés sur appareil partagé.

**Ne pas mettre en V2 sans nouvelle décision :** lecture clinique hors connexion, stockage de santé en navigateur, alertes médicales automatiques et délégation adulte générale. *(Décision du 02/11/2026 : la lecture seule des déclarations est livrée ; elle reste soumise à revue juridique, analyse de menace et décision signée avant publication. Historique, consultations, documents, chiffrement, écriture et synchro hors connexion : inchangés.)*

---

# V3 — Authentification renforcée et intégrations cliniques conditionnelles

**Objectif :** renforcer la preuve d’identité et ouvrir des intégrations contrôlées, uniquement après stabilisation et audit de la V1/V2.

## V3.1 — Sécurité de compte

- Ajouter une preuve supplémentaire à la récupération de compte : e-mail vérifié ou OTP SMS, sans énumération d’adresses (aujourd'hui la bonne réponse à la question secrète suffit ; MFA/TOTP et OTP sont absents du code).
- Ajouter MFA/TOTP avec secret chiffré, limitation d’essais, codes de secours et procédure de perte d’appareil. *(Décision du 04/11/2026 : pas de MFA pour l'équipe ni pour les professionnels pour le moment.)*
- Renforcer la sécurité des comptes établissement et staff en priorité.
- Mettre en place rotation de secrets, gestion de clés et procédure de récupération administrée.

## V3.2 — Continuité entre établissements

- Décider séparément le modèle A → B : demande, identité patient, périmètre, durée, révocation et conservation.
- Étendre C2 seulement si le consentement, l’audit et les règles juridiques sont validés.
- Si une copie institutionnelle est retenue, la traiter comme un instantané daté, attribué, en lecture seule et corrigé par addendum ; jamais d’édition de l’original.
- Ajouter impression/export des instantanés avec audit et règles de conservation.
- Ajouter procédure d’incident, rectification et fin de prise en charge.
- Ne pas ajouter de recherche libre de patients ni d’accès administrateur global.
- Garder le « bris de glace » désactivé tant qu’une décision produit, juridique et sécurité distincte n’est pas signée.

## V3.3 — Intégrations sous contrat

- Téléconsultation audio d’abord, sans enregistrement par défaut.
- Téléexpertise entre professionnels avec périmètre et consentement patient.
- Résultats de laboratoire via partenaires et formats validés.
- Ordonnance électronique avec QR pharmacie uniquement après validation réglementaire.
- Paiement mobile money uniquement après contrats, sécurité financière, remboursements et conformité.
- Capteurs/Health Connect/Apple Santé seulement via intégration native ou fournisseur confirmé ; aucune mesure déduite par caméra.

---

# V4 — Interopérabilité, portabilité et programmes de santé

**Objectif :** permettre des échanges structurés, contrôlés et auditables, sans transformer Mon E-Carnet en annuaire ouvert.

- Export structuré FHIR/JSON du dossier choisi, avec version, provenance et journal d’export.
- Import de résultats et documents provenant de partenaires vérifiés.
- Connecteurs établissements avec consentement et révocation.
- Gestion de versions, addenda, corrections et rapprochement d’identité sans fusion silencieuse.
- Portail programme de santé avec statistiques agrégées et minimisées.
- Tableaux de bord anonymisés/pseudonymisés séparant strictement statistiques et dossiers individuels.
- Contrats, DPA, responsabilités et localisation des données documentés pour chaque partenaire.
- Revue indépendante de sécurité et tests d’interopérabilité avant ouverture.

**Condition V4 :** aucune interopérabilité ne doit permettre à un partenaire de rechercher librement des carnets ou d’obtenir un accès clinique par simple appartenance à une organisation.

---

# V5 — Écosystème professionnel et modèle économique

**Objectif :** passer d’un carnet partagé à un service soutenable pour les établissements et programmes autorisés.

- Abonnements établissement et suivi des factures.
- Groupes de comptes rattachés à une organisation payeuse, avec séparation des rôles et facturation.
- Catalogue de services et partenaires vérifiés.
- Workflows de prise en charge, références et retours structurés.
- Indicateurs opérationnels minimisés : délais, activité, disponibilité, qualité de service.
- Centre de conformité client : exports d’audit, contrats, sous-traitants, incidents et demandes de droits.
- Support multicanal documenté et procédures d’escalade.
- Tests de charge, multi-tenant, isolation organisationnelle et plan de continuité renforcé.

**Condition V5 :** la facturation ne doit jamais devenir une condition cachée d’accès à une donnée clinique déjà autorisée, et les données de santé ne doivent pas être utilisées à des fins commerciales non validées.

---

# V6 — Plateforme de santé responsable et assistance avancée

**Objectif :** explorer les fonctionnalités avancées uniquement après preuve d’utilité, sécurité et gouvernance.

- Assistant de préparation de consultation limité à la reformulation et à la suggestion de questions ; aucun diagnostic ni triage automatique.
- Contenus éducatifs personnalisés, relus médicalement et disponibles en français simple/audio/langues retenues.
- Suivis spécialisés : grossesse, enfant, croissance et maladies chroniques, chacun avec validation médicale propre.
- Recherche fédérée strictement consentie et non indexée publiquement, si elle devient nécessaire.
- Détection de qualité des données et rappels explicables, sans décision médicale automatique.
- Gouvernance de l’IA : jeux de tests, biais, traçabilité, consentement, hébergement, suppression et supervision humaine.
- API publique limitée et écosystème développeur seulement après modèle de menace et certification des clients.
- Étude d’une application mobile native si la PWA ne suffit plus pour les notifications, capteurs ou usage hors ligne chiffré.

**Condition V6 :** aucune fonctionnalité d’IA ou d’automatisation ne doit diagnostiquer, prescrire, décider d’une urgence ou remplacer un professionnel sans cadre réglementaire et supervision humaine explicite.

---

# Tableau de décision rapide

| Version | Ce qui est prioritaire | Ce qui bloque la version |
|---|---|---|
| **V1** | Staging, tests cible, SMTP, stockage privé, sauvegardes, sécurité, accessibilité, validation médicale/juridique et Go/No-Go | Données réelles interdites tant que les portes ne sont pas signées |
| **V2** | Recetter plans de suivi et rappels (livrés) ; finir graphiques de mesures, rendez-vous côté professionnel, patients récents, résumé des accès, plusieurs administrateurs, relances, indicateurs établissement, accessibilité et faible débit | Qualité médicale des parcours et protection des données hors ligne |
| **V3** | MFA/OTP, récupération renforcée, continuité A→B et intégrations cliniques | Modèle juridique, partenaires, audit de sécurité et consentement granulaire |
| **V4** | FHIR, import/export partenaires, statistiques programmes | Contrats, gouvernance, identité et interopérabilité sécurisée |
| **V5** | Facturation, organisations, support et exploitation multi-tenant | Modèle économique, isolation et conformité contractuelle |
| **V6** | Assistance avancée, contenus spécialisés, IA gouvernée et application native éventuelle | Preuve d’utilité, supervision humaine, réglementation et gouvernance IA |

# Écarts constatés entre le code et les documents (31 octobre 2026)

1. **Données réelles :** la FAQ, l'accueil et la page de confidentialité affirment que de vraies données de santé peuvent être saisies ; c'est contraire au NO-GO. **→ Corrigé le 04/11/2026 : textes alignés sur le NO-GO (phase de test, données fictives).**
2. **Ouverture de dossier par l'administrateur :** durée sans limite par défaut, motif Urgence, lecture clinique activée par défaut, aucun écran ; les documents parlent d'une ouverture temporaire. **→ Corrigé le 04/11/2026 : 30 minutes par défaut, lecture désactivée par défaut ; écran à construire.**
3. **Stockage :** le stockage par défaut est local ; Cloudinary seulement s'il est configuré ; la confidentialité ne le cite pas.
4. **Push et copie d'urgence :** non décrits dans la page de confidentialité ; pas de désabonnement à la déconnexion. *(Corrigé le 02/11/2026 : politique de confidentialité, Aide et accueil mis à jour ; désabonnement à la déconnexion livré.)*
5. **Secrets et fichiers parasites** toujours dans l'archive ; README daté du 14/10/2026 avec des chiffres de tests périmés.
6. **CI écrite mais jamais exécutée** ; 6 tests web en échec.

# Ordre concret recommandé maintenant

1. Corriger les textes publics, confirmer qu'aucune donnée réelle n'a été saisie, retirer les secrets et fichiers parasites de l'archive, puis renouveler les secrets.
2. Trancher la règle d'accès de l'administrateur d'établissement (durée, motif Urgence, écran, base légale A8).
3. Exécuter la CI et corriger les 6 tests web en échec ; rejouer les tests Django, `makemigrations --check`, lint et build.
4. Terminer les portes V1 : staging, PostgreSQL cible, SMTP, stockage privé, sauvegarde/restauration, sécurité, hébergement et Go/No-Go.
5. Écrire les tests end-to-end des parcours déjà livrés avant d'ajouter de nouvelles fonctions.
6. Finir les interfaces V2 manquantes : rendez-vous côté professionnel, graphiques, patients récents, indicateurs établissement ; la saisie de mesures par le médecin (PRO-13) est livrée localement, recette staging à faire.
7. Ne commencer V3 qu'après validation de la V1 et décision écrite sur MFA, récupération et partage A→B.
8. Ne planifier V4, V5 et V6 qu'après retours du pilote fictif, partenaires confirmés et revue de risques.

## Documents à considérer comme secondaires

- `docs/.cdc/Mon E-Carnet - Cahier des charges v13.pdf` : cahier des charges courant, établi à partir du code ; les versions v11 et v12 sont historiques.
- `docs/.cdc/Mon E-Carnet - Reste a faire v2026-10-31.pdf` : version PDF du présent document.
- `docs/.cdc/E-Carnet_Reste-a-faire.pdf` et l'ancien « Reste à faire.pdf » : anciennes photographies du projet, à ne plus utiliser comme backlog courant.
- `docs/ROADMAP-V1-V5.md` : intentions produit historiques ; ce document ajoute la vue V6 et corrige l’état des fonctions déjà codées.
- `docs/ROADMAP-V2.md` : détail complémentaire V2, à lire avec la présente feuille de route.
- `docs/ETAT-REEL-V1.md` : preuves et contrôles datés ; il ne remplace pas ce backlog.


---
# V1 — Complément AKATECH : capacité, optimisation et Hodi

Le plan détaillé est dans [`docs/AKATECH-PLAN-OPTIMISATION-CHARGE-HODI.md`](AKATECH-PLAN-OPTIMISATION-CHARGE-HODI.md). Il ajoute les travaux d’exploitation suivants au socle V1 :

- **P0 :** (la CI est écrite mais jamais exécutée) image frontend de production (`next build`/`next start`), séparation des migrations et du démarrage, stockage privé persistant, réponses Hodi écrites, staging séparé et CI avec scans.
- **P1 :** Redis partagé pour le cache et les limitations distribuées, vérification des index PostgreSQL, pagination et payloads bornés, tests de concurrence QR/grants, quotas d’upload et `request_id` sans données médicales.
- **P2 :** scénario k6 A/B/C prêt pour 100, 300 puis 1 000 utilisateurs virtuels ; exécution staging, métriques RED/USE, nettoyage quotidien, restauration mesurée et décision Site Pro/Cyber+ restent à produire avec l’environnement cible. Audit axe automatisé et protocole mobile sont disponibles.
- **P3 :** étude multi-instance uniquement si l’API est le goulot après les profils de charge. Le load balancer n’est pas automatique à 4 000 patients : il exige une application sans état local, cache partagé, stockage partagé, health checks et confirmation Hodi.

**Décision actuelle :** pas de Kubernetes ni de load balancer ajouté au dépôt à ce stade. L’offre Site Pro est destinée au pilote fictif ; Cyber+ est à examiner pour la continuité de service ; Archipel ou serveur dédié seulement si le stockage, le temps de réponse ou la capacité mesurée l’exigent. Les données de santé réelles restent interdites jusqu’au Go/No-Go formel.
