# Audit de conformité et d’alignement — Mon Carnet Numérique

> **Audit historique du 05/10/2026, remplacé pour l’état courant.** Plusieurs constats et tâches ci-dessous ont depuis changé (notamment A9, QR, sanitizer SVG, invitation, conditions de rattachement, résiliation et tests PostgreSQL/restauration). Ne pas les traiter comme des décisions actives. Références actuelles : [état réel V1](ETAT-REEL-V1.md), [roadmap](ROADMAP-V1-V5.md), [recette](RECETTE-V1.md).

**Dépôt audité :** archive `e-carnet.zip`, extraite le 05/10/2026.  
**Portée :** comparaison du code backend/frontend, des tests, des prototypes mobiles et des nouvelles décisions du porteur.  
**Important :** cet audit technique n’est ni une certification, ni un avis juridique/médical, ni une acceptation de la V1.

## Verdict exécutif

Le dépôt possède un **socle fonctionnel réel**. Les contrôles locaux sont concluants sur la suite disponible : **52 tests Django détectés, 51 réussis et 1 ignoré**, tandis que `manage.py check`, les migrations, le lint et le build Next.js réussissent (**26 routes**). Cela ne signifie pas que tous les parcours sont livrés ni que la V1 est prête pour un pilote.

Le rapport contenu dans l’archive était **en partie périmé** : contrairement à ce rapport ancien, le dépôt contient maintenant une configuration Argon2id, des modèles/callbacks OAuth et des fonctions backend QR, ainsi qu’un contrôle SVG et hash/horodatage. Ces éléments sont toutefois de complétude variable; les limites sont détaillées ci-dessous.

## Résultat face aux décisions disponibles lors de l’audit du 05/10

> Le tableau ci-dessous conserve des constats historiques sur l’archive auditée. Lorsqu’un item est signalé supersédé, ne pas le reprendre comme état actuel ; voir l’état réel et la roadmap courante.

| Sujet | État du code actuel | Verdict |
|---|---|---|
| Attestation SVG | XML parsé; quelques balises/attributs interdits rejetés; SHA-256 et horodatage persistés. Aucune allowlist exhaustive : CSS, références externes et variantes SVG non couvertes par les contrôles simples. | **Partiel — sécurité insuffisante pour considérer le SVG assaini.** |
| Argon2id | `argon2-cffi` est déclaré; `Argon2PasswordHasher` est en première position de `PASSWORD_HASHERS`, PBKDF2 reste accepté pour vérification de comptes historiques. | **Configuré dans le code; à recetter sur déploiement réel et sur comptes existants.** |
| Google / Facebook / Apple | `AuthIdentity`, contraintes d’unicité provider+ID et compte+provider, routes start/callback, state de session et conflit d’email sans fusion silencieuse existent. `AuthForms` présente des liens vers ces routes. | **Socle OAuth présent, intégration produit incomplète.** Pas de secrets réels dans le dépôt; pas de page visible pour lier/délier un fournisseur; le callback renvoie du JSON; pas de couverture de tests OAuth démontrée; journalisation de liaison manquante. Apple demande sa configuration Developer et un client secret valide. |
| Doublons identité | Une reconnexion par même `(provider, provider_user_id)` retrouve le compte. Une adresse déjà portée par un autre compte déclenche un conflit au lieu d’une fusion automatique. | **Garde-fous backend présents; parcours utilisateur et tests de bout en bout à achever.** |
| OTP SMS | Aucun parcours SMS n’est livré. | **Conforme à la décision : reporté en V3.** |
| Onboarding | L’inscription e-mail demande déjà nom/prénom et crée par défaut un contexte Patient. Une page permet ensuite Patient/Professionnel. Pas d’étape identité autonome avec avatar modifiable, pas de reprise complète; formulaire patient et profil professionnel n’implémentent pas les champs/documents demandés. | **Non conforme au parcours retenu.** |
| Professionnel et justificatifs | Profil actuel limité; aucun justificatif personnel du médecin n’est collecté. Le rattachement passe par code 48 h puis décision établissement. | **Partiel :** UI métier et recette staging restent à compléter. |
| Startup / administrateur établissement | Routes staff, console, relation administrateur nominative, invitation hashée 48 h et code médecin hashé 48 h présents côté API/UI. | **Partiel :** configuration SMTP de staging et durcissement production restent à valider. |
| Accès clinique | Contexte professionnel, établissement actif, membership active et consentement patient contrôlés côté serveur. | **Présent côté code ;** recette multi-structure et staging à produire. |
| QR d’AccessGrant | Constat de l’audit du 05/10 : API patient avec jeton opaque hashé et usage unique. | **Constat supersédé :** l’UI est présente, la durée A9 de 5 minutes est appliquée ; l’UUID patient reste à saisir séparément. Consulter l’état réel V1. |
| Scopes AccessGrant | Constat de l’audit du 05/10 : les scopes étaient décrits comme non validés métier. | **Constat supersédé :** A9 est décidé et appliqué : `preconsultation` + `declarations` par défaut, `consultations` sélectionnable, `documents` hors V1. |
| MFA/TOTP | Constat de l’audit historique : modèles, endpoints et seed résiduels exposaient les secrets alors que la décision produit reporte le MFA en V3. | **Traité dans le correctif :** endpoints et modèle retirés de la V1, suppression des données de seed MFA; réimplémentation chiffrée et limitée réservée à V3. |
| Auth et design | Auth en français et marque E-carnet; logos fournisseurs en SVG; plus de bouton social « Autre » dans le composant vérifié. Navigation métier utilise encore des glyphes Unicode (`⌂`, `▤`, `＋`, `↗`, `●`) et non un système d’icônes cohérent. | **Mieux que l’ancien audit, mais reste à aligner visuellement.** |
| Maquettes mobiles | Le code reprend les espaces, cartes et parcours de base, mais la composition live ne reproduit pas la maquette mobile. La demande actuelle est de reprendre l’expérience générale (navigation, densité, proportions, icônes), en conservant les flows décidés, non de recopier les anciens flows. | **Alignement design partiel; travail UI mobile prioritaire.** |

## Compréhension du flow établissement retenu

Patient et Professionnel gardent leurs comptes séparés par contexte; l’espace établissement est à part, privé et administré par **une personne nominative** (un seul administrateur actif en V1). Le terme « Root » global est abandonné. L’établissement transmet les preuves de la structure par e-mail officiel; un membre autorisé de l’équipe E‑Carnet les vérifie hors application, puis utilise une console staff protégée pour créer la structure et envoyer une invitation unique valable 48 h. Le responsable définit son mot de passe; aucun secret n’est envoyé dans l’e-mail.

L’établissement vérifie les médecins en interne. E‑Carnet ne collecte pas leurs pièces personnelles. L’administrateur crée un code à usage unique valable 48 h; sa saisie ouvre seulement une demande `pending`, et l’établissement doit ensuite accepter/refuser. Cette approbation atteste le rattachement institutionnel de ce médecin à cette structure. Les comptes établissement n’ont jamais d’accès aux dossiers patients; le médecin seul demande un AccessGrant avec consentement patient. Les invitations, codes, changements d’admin et adhésions gardent un historique non destructif.

Le code courant implémente désormais le flow privé : route publique neutralisée, staff, administrateur nominatif, invitation et code à usage unique. Les limites sont la configuration SMTP de staging, la recette production et la concurrence PostgreSQL. Détails et plan dans [FLOW-ETABLISSEMENT.md](FLOW-ETABLISSEMENT.md) et [ADR-002](adr/ADR-002-etablissement-invitation-et-rattachement.md).

## Vérifications rejouées le 05/10/2026

- `npm run test:api` : **52 tests détectés : 51 réussis et 1 ignoré**.
- `npm run check:api` : aucune erreur système.
- `makemigrations --check --dry-run` : aucune migration manquante.
- `npm run lint` : réussi.
- `npm run build` : réussi; **26 routes statiques générées**.
- `npm ci` signale **5 vulnérabilités high** dans l’arbre de dépendances d’outillage; elles exigent une revue avant publication.
- Avertissement Authlib : import `authlib.jose` déprécié.

Non démontré par cette exécution : OAuth avec les consoles fournisseurs, staging/cookies/CSRF, Android/4G, trigger append-only sur PostgreSQL réel, Compose/Docker runtime, restauration/RPO/RTO, revue de sanitation hostile SVG ou approbation juridique/médicale.

## Correctifs ciblés apportés le 08/10/2026

- **CA‑13 corrigé localement :** verrou `select_for_update(of=("self",))` dans transaction et test de deux requêtes concurrentes sur PostgreSQL 16.
- **CA‑19 corrigé localement :** provenance établissement FK pour les nouvelles pré-consultations, filtre de lecture/validation inter-site, provenance serveur non libre et test A/B avec grant B valide.
- **Audit de lecture partiellement corrigé :** les lectures cliniques autorisées sont inscrites et visibles au patient, avec métadonnées minimisées; l’interdiction PostgreSQL `TRUNCATE` reste à mettre en place.
- **Médecin :** aucune saisie ni sérialisation de numéro professionnel; spécialité/rôle déclaratif dans une liste extensible. L’établissement vérifie ses médecins en interne et l’application journalise sa décision de rattachement. Le champ DB historique n’est pas supprimé par migration; rétention/purge à décider.
- **Revalidation consignée :** le rapport PostgreSQL du 08/10 indique 77 tests réussis, zéro échec/ignoré. Le chiffre « 80 » d’une version intermédiaire était erroné ; voir [la preuve enregistrée](../reports/postgres-tests-20261008.txt). Lint/build/migrations doivent être relancés si le code change.

## Priorités toujours ouvertes

1. Protéger les événements d’audit contre `TRUNCATE`, limiter les privilèges du rôle runtime et tester sur PostgreSQL cible.
2. Vérifier les contraintes SQL AccessGrant et l’expiration/règle après refus sur la cible ; les scopes A9 sont décidés (5 min, scopes par défaut et `documents` hors V1).
3. Traiter l’identifiant compte entier et la normalisation de casse e-mail.
4. Compléter QR (retirer l’UUID obligatoire), OAuth (email vérifié et PKCE), SMTP staging, tests fournisseurs et Apple séparément.
5. Définir politique de rétention/purge des preuves établissement reçues par e-mail et d’éventuels numéros historiques; validations juridiques/médicales avant données réelles.
6. Rejouer les tests de sécurité et d’expérience sur staging, mobile/4G et clavier/lecteur d’écran.
8. Fermer les essais opérationnels (staging, PostgreSQL, restauration, appareils mobiles et dépendances).

Cette passe met à jour la documentation uniquement ; le code audité est celui livré dans l’archive.


## Note de couverture des tests ciblés

Cette note de couverture reflète la passe d’audit du 05/10 et est supersédée sur le SVG : les charges SVG adversariales sont désormais couvertes par les tests locaux du sanitizer strict. Les tests OAuth fournisseur réel et la concurrence/recette du parcours QR restent à prouver ; voir [SECURITY.md](SECURITY.md) et [la recette à jour](RECETTE-V1.md).
