# Mon E-Carnet — Reste à faire réel et feuille de route V1 à V6

**Document de référence : 29 octobre 2026**  
**Source principale :** code du dépôt `apps/api` et `apps/web`, migrations, tests et documentation technique.  
**Statut global :** V1 fonctionnelle en local, mais non validée pour des données de santé réelles.

> Ce document remplace les anciennes listes qui décrivaient encore comme « à faire » plusieurs fonctions déjà présentes dans le code. Une fonction marquée **Livré localement** existe dans l’API et/ou l’interface, mais peut encore nécessiter une recette staging, mobile, juridique ou médicale.

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
- OAuth Google, Facebook et Apple : endpoints, callbacks, liaison/déliaison et audit présents ; configuration réelle encore à recetter.
- Thèmes, palettes, paires de polices et tailles de texte persistés par compte.
- Demande de suppression/suspension de compte et traitement administrateur présents.

### Patient et carnet

- Déclarations de santé avec provenance.
- Pré-consultation en brouillon, modification et clôture par le professionnel.
- Consultations signées, historique, constantes, ordonnance structurée et examens demandés.
- Vaccinations : ajout patient et confirmation professionnelle.
- Mesures de santé : saisie et lecture autorisée.
- Documents médicaux : dépôt patient, téléchargement contrôlé et lecture professionnelle selon périmètre.
- Plans de suivi : création professionnelle et lecture patient.
- Rappels de médicaments et confirmations de prise.
- Rendez-vous : demande patient, confirmation/annulation selon les endpoints disponibles.
- Notifications applicatives et boîte de notifications.
- Export PDF volontaire du carnet, journalisé.
- PDF d’ordonnance signé avec modèle d’établissement quand il est disponible.

### Accès et sécurité métier

- QR professionnel opaque, à usage unique, valable cinq minutes et consommé atomiquement.
- AccessGrant : demande, consentement, refus, expiration de deux heures, deux prolongations d’une heure et révocation.
- Scopes `preconsultation`, `declarations`, `consultations`, `documents` et `care_history` avec contrôle serveur.
- Journal patient des accès, avec ressource et quantité, sans contenu médical dans les métadonnées.
- Proche de confiance : compte séparé, mot de rattachement à usage unique, sélection d’un carnet, lecture seule de la fiche d’urgence et révocation.
- Adressage C1 : proposition, consentement granulaire patient, inbox destinataire, ouverture explicite et snapshot.
- C2 : lecture de l’historique validé provenant de structures sources choisies par le patient, sans copie conservée en V1.
- Carte d’urgence publique, QR distinct, activation/désactivation, appel du contact et limitation par IP.
- Carte hors ligne/exportable distincte du QR public.
- Représentation d’un enfant mineur et transfert encadré vers le compte adulte via revue staff.

### Établissement et exploitation métier

- Création staff et validation d’un établissement privé.
- Administrateur nominatif historisé, invitation et remplacement.
- Code médecin à usage unique, demande de rattachement `pending`, acceptation/refus, départ et suspension.
- Liste établissement sans contenu clinique.
- Ouverture temporaire locale avec motif obligatoire, audit et notification patient.
- Journal staff des événements établissement.
- Modèle de pré-consultation établissement.
- Catalogue d’établissements et fiche établissement.

### Qualité déjà contrôlée

- `manage.py check` sans erreur.
- `makemigrations --check --dry-run` sans migration manquante.
- Lint frontend sans erreur ; les avertissements `<img>` restent non bloquants.
- Build Next.js réussi localement.
- Tests ciblés patients, soins, referrals et délégations déjà exécutés dans les passes précédentes.

---

# V1 — Finaliser, sécuriser et autoriser le socle

**Objectif :** obtenir une V1 techniquement recettée, juridiquement cadrée et prête pour un pilote fictif contrôlé. La V1 ne doit pas recevoir de données réelles avant la validation formelle.

## V1.1 — Bloquants de recette et de déploiement

| Priorité | Travail restant | État | Critère de sortie |
|---|---|---|---|
| P0 | Déployer un staging séparé avec données fictives | Non commencé / environnement non démontré | URL, secrets séparés, base séparée et procédure de restauration documentée |
| P0 | Rejouer les tests API sur PostgreSQL de staging | À recetter | Suite backend, concurrence QR, isolation A/B, révocation et permissions vertes |
| P0 | Configurer SMTP réel | Partiel | SPF, DKIM, DMARC, délivrabilité, expiration, renvoi et non-exposition des secrets vérifiés |
| P0 | Vérifier stockage privé des fichiers | Partiel | Documents, avatars, logos, cachets et signatures ne sont jamais publics par défaut |
| P0 | Sauvegardes et restauration | Partiel | Sauvegarde planifiée, restauration testée, RPO/RTO mesurés et approuvés |
| P0 | Sécurité base de données | Partiel | Permissions runtime, append-only, interdiction `TRUNCATE` et migrations vérifiées sur la cible |
| P0 | Secrets et archives | À faire | Aucun `.env`, secret ou `db.sqlite3` sensible dans les archives livrées ; secrets historiques renouvelés |
| P0 | Go/No-Go données réelles | À décider | Validation écrite produit, médicale, juridique, sécurité et hébergement |

## V1.2 — Recette des parcours existants

- Recetter l’inscription, l’onboarding Patient/Professionnel et la reprise après interruption.
- Configurer et tester OAuth Google, Facebook et Apple avec vrais callbacks de staging.
- Tester le QR sur Android et iPhone : permission caméra, saisie manuelle de secours, expiration et QR déjà consommé.
- Recetter le consentement : périmètre affiché, exclusions, durée, refus, prolongation et révocation.
- Recetter le proche de confiance : génération, remise manuelle du mot, consommation unique, sélection, lecture limitée et retrait immédiat.
- Recetter C1/C2 : consentement granulaire, choix des structures sources, ouverture destinataire, lecture seule, audit et expiration.
- Recetter l’ouverture établissement : liste sans contenu, motif obligatoire, durée, notification patient et absence d’accès inter-établissements.
- Tester la carte d’urgence publique et la carte hors ligne sur téléphone réel, papier et réseau lent.
- Vérifier que le service worker et les caches ne stockent aucune donnée clinique privée.
- Rejouer les tests de sanitation SVG et le rendu du cachet/signature sur staging.

## V1.3 — Sécurité, accessibilité et expérience

- Corriger les tests web qui dépendent de chemins Windows, puis rejouer la suite complète.
- Ajouter une CI reproductible : lint, typecheck, build, tests web, tests Django et `makemigrations --check`.
- Mettre en place une surveillance sans contenu médical : erreurs frontend/backend, disponibilité, échec SMTP et tâches de nettoyage.
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
- Obtenir l’avis juridique ivoirien et confirmer les formalités auprès de l’autorité compétente.

**Sortie V1 :** pilote fictif possible uniquement après signature des critères de recette. Traitement de données réelles toujours interdit tant que l’hébergement, la conformité et le Go/No-Go ne sont pas validés.

---

# V2 — Prévention et suivi quotidien réellement exploitable

**Objectif :** transformer les briques déjà présentes en parcours de suivi fiables, complets et utiles au patient, sans diagnostic automatique.

## V2.1 — Compléter les fonctions déjà amorcées

- Finaliser la recette staging de l’interface professionnelle des plans de suivi, avec objectifs, fréquence, statut et historique ; l’interface et l’API sont livrées localement.
- Améliorer les graphiques de mesures : tendances, périodes, provenance, unités et absence de fausse alerte.
- Compléter les rappels de médicaments : récurrence, stock, renouvellement, notifications et reprise hors connexion sans données non chiffrées.
- Compléter les rendez-vous : côté professionnel/établissement, confirmation, déplacement, annulation, rappels et états cohérents.
- Ajouter les patients récents côté professionnel avec minimisation, durée de conservation et règles de confidentialité.
- Ajouter l’alerte de consultation de la carte d’urgence, sans collecter plus que nécessaire.
- Ajouter un résumé périodique des accès contrôlable par le patient.
- Compléter l’export du carnet : périmètre choisi, avertissement, journal, révocation impossible du fichier téléchargé et documentation de portabilité.

## V2.2 — Établissements et coordination

- Finaliser la console équipe : remplacement administrateur depuis l’interface, suspension/réactivation, renvoi d’invitation et journal consultable.
- Ajouter plusieurs administrateurs par établissement avec rôles précis, sans compte partagé.
- Ajouter des compteurs établissement sans contenu clinique : médecins actifs, codes actifs, demandes en attente.
- Ajouter les relances internes pour invitation expirée et rattachement en attente.
- Finaliser les modèles de pré-consultation configurables après validation médicale.
- Ajouter un parcours professionnel complet pour les décisions de rattachement et la visibilité limitée des fiches.

## V2.3 — Accessibilité et faible débit

- Mode faible débit : réduction des images, reprise de requêtes, écrans légers et files d’attente explicites.
- Langage simple et pictogrammes validés par des utilisateurs réels.
- Lecture audio des contenus éducatifs après validation des textes et des langues à supporter.
- Notifications applicatives regroupées sans réduire l’audit ni masquer les événements importants.
- PWA installable et parcours de connexion contrôlés sur appareil partagé.

**Ne pas mettre en V2 sans nouvelle décision :** lecture clinique hors connexion, stockage de santé en navigateur, alertes médicales automatiques et délégation adulte générale.

---

# V3 — Authentification renforcée et intégrations cliniques conditionnelles

**Objectif :** renforcer la preuve d’identité et ouvrir des intégrations contrôlées, uniquement après stabilisation et audit de la V1/V2.

## V3.1 — Sécurité de compte

- Ajouter une preuve supplémentaire à la récupération de compte : e-mail vérifié ou OTP SMS, sans énumération d’adresses.
- Ajouter MFA/TOTP avec secret chiffré, limitation d’essais, codes de secours et procédure de perte d’appareil.
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
| **V2** | Finir mesures, rappels, rendez-vous, plans de suivi, console établissement, accessibilité et faible débit | Qualité médicale des parcours et protection des données hors ligne |
| **V3** | MFA/OTP, récupération renforcée, continuité A→B et intégrations cliniques | Modèle juridique, partenaires, audit de sécurité et consentement granulaire |
| **V4** | FHIR, import/export partenaires, statistiques programmes | Contrats, gouvernance, identité et interopérabilité sécurisée |
| **V5** | Facturation, organisations, support et exploitation multi-tenant | Modèle économique, isolation et conformité contractuelle |
| **V6** | Assistance avancée, contenus spécialisés, IA gouvernée et application native éventuelle | Preuve d’utilité, supervision humaine, réglementation et gouvernance IA |

# Ordre concret recommandé maintenant

1. Figer ce document comme backlog de référence et archiver les anciens PDF « reste à faire » comme historiques.
2. Terminer les portes V1 : staging, PostgreSQL cible, SMTP, stockage privé, sauvegarde/restauration, sécurité et Go/No-Go.
3. Écrire les tests end-to-end des parcours déjà livrés avant d’ajouter de nouvelles fonctions.
4. Finir les interfaces V2 déjà amorcées : plans de suivi, rendez-vous professionnel, rappels et console établissement.
5. Ne commencer V3 qu’après validation de la V1 et décision écrite sur MFA, récupération et partage A→B.
6. Ne planifier V4, V5 et V6 qu’après retours du pilote fictif, partenaires confirmés et revue de risques.

## Documents à considérer comme secondaires

- `docs/.cdc/E-Carnet_Reste-a-faire.pdf` : ancienne photographie du projet, à ne plus utiliser comme backlog courant.
- `docs/ROADMAP-V1-V5.md` : intentions produit historiques ; ce document ajoute la vue V6 et corrige l’état des fonctions déjà codées.
- `docs/ROADMAP-V2.md` : détail complémentaire V2, à lire avec la présente feuille de route.
- `docs/ETAT-REEL-V1.md` : preuves et contrôles datés ; il ne remplace pas ce backlog.


---
# V1 — Complément AKATECH : capacité, optimisation et Hodi

Le plan détaillé est dans [`docs/AKATECH-PLAN-OPTIMISATION-CHARGE-HODI.md`](AKATECH-PLAN-OPTIMISATION-CHARGE-HODI.md). Il ajoute les travaux d’exploitation suivants au socle V1 :

- **P0 :** image frontend de production (`next build`/`next start`), séparation des migrations et du démarrage, stockage privé persistant, réponses Hodi écrites, staging séparé et CI avec scans.
- **P1 :** Redis partagé pour le cache et les limitations distribuées, vérification des index PostgreSQL, pagination et payloads bornés, tests de concurrence QR/grants, quotas d’upload et `request_id` sans données médicales.
- **P2 :** scénario k6 A/B/C prêt pour 100, 300 puis 1 000 utilisateurs virtuels ; exécution staging, métriques RED/USE, nettoyage quotidien, restauration mesurée et décision Site Pro/Cyber+ restent à produire avec l’environnement cible. Audit axe automatisé et protocole mobile sont disponibles.
- **P3 :** étude multi-instance uniquement si l’API est le goulot après les profils de charge. Le load balancer n’est pas automatique à 4 000 patients : il exige une application sans état local, cache partagé, stockage partagé, health checks et confirmation Hodi.

**Décision actuelle :** pas de Kubernetes ni de load balancer ajouté au dépôt à ce stade. L’offre Site Pro est destinée au pilote fictif ; Cyber+ est à examiner pour la continuité de service ; Archipel ou serveur dédié seulement si le stockage, le temps de réponse ou la capacité mesurée l’exigent. Les données de santé réelles restent interdites jusqu’au Go/No-Go formel.
