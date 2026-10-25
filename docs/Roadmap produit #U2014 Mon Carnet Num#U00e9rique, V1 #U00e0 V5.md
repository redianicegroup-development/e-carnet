# Roadmap produit — Mon Carnet Numérique, V1 à V5

> **Copie historique supersédée.** Ne pas utiliser ce document pour implémenter ou restaurer des flows : il contient des décisions et constats remplacés. La source produit active est [ROADMAP-V1-V5.md](ROADMAP-V1-V5.md) ; l’état du code est [ETAT-REEL-V1.md](ETAT-REEL-V1.md).

**Document d’origine : 05/10/2026 — décision du porteur et comparaison au dépôt `e-carnet.zip`.**  
**Statut à cette date :** V1 en construction/recette locale, non acceptée. Ce document n’est plus la source de vérité : se référer aux documents actuels ci-dessus. Les éléments médicaux/juridiques non explicitement arbitrés restent soumis à validation.

> Les prototypes HTML sont une **référence visuelle mobile** (ambiance, hiérarchie, navigation, densité, cartes et icônes), non une source de parcours fonctionnel. Ne pas recopier les anciens flows des maquettes lorsqu’ils contredisent cette roadmap.

## 1. Principes et acteurs

- Une personne = une identité utilisateur; plusieurs méthodes de connexion peuvent être rattachées explicitement. Ne jamais fusionner deux comptes silencieusement sur la seule égalité d’e-mail.
- Patient propriétaire du carnet et seul décisionnaire du consentement d’accès aux données cliniques.
- Professionnel, en V1 principalement médecin, doit être autorisé et rattaché avant de demander un AccessGrant; aucune donnée avant le consentement patient.
- L’Établissement est un espace **privé**, non proposé à l’inscription publique, avec un administrateur nominatif (un seul actif par structure en V1). Le terme « Root » n’est pas un rôle global retenu.
- Les demandes et lectures de dossiers sont faites dans le contexte **Professionnel**, sous rattachement actif, établissement actif et AccessGrant accepté. L’établissement ne devient pas propriétaire du carnet.
- Aucun compte/espace/endpoint infirmier autonome en V1. Aucune donnée de santé réelle pendant développement, tests ou pilote fictif.
- TOTP/MFA et OTP SMS sont reportés en V3; aucun ne bloque le parcours V1.

## 2. Parcours d’identité et onboarding cible

### Inscription et connexion

Méthodes V1 prévues : e-mail + mot de passe, Google, Facebook et Apple lorsque les configurations externes sont disponibles. Chaque compte externe est identifié par `(provider, provider_user_id)`. Une nouvelle méthode se lie depuis une session déjà authentifiée; email identique sans preuve de contrôle du compte existant = conflit, pas de fusion.

À la date du document d’origine, le code contenait déjà des callbacks OAuth, `AuthIdentity` et des contraintes anti-doublon. Le parcours UI de liaison/déliaison est depuis présent ; les secrets réels, tests fournisseurs et validations staging restent à faire. OTP SMS est **V3**; WhatsApp n’est pas retenu.

### Étape 1 — identité de base

Nom, prénoms et avatar. Les nom/avatar transmis par le fournisseur peuvent préremplir l’écran; ils restent modifiables. L’avatar doit pouvoir être choisi/importé puis remplacé ou supprimé.

### Étape 2 — choix public du contexte

Choix limité à **Patient** ou **Professionnel**. Le choix ne crée pas une seconde identité. Aucun choix public « Root » ou « Établissement ».

### Étape 3 — formulaire métier

- **Patient :** nom/prénoms déjà définis à l’étape 1; date de naissance; téléphone facultatif au format local (+225); autres champs du carnet au besoin. Exemple d’affichage fourni par le porteur : nom « Koné », prénoms « Awa »; c’est un exemple, pas une donnée de test à réutiliser.
- **Professionnel/médecin :** nom/prénoms et avatar issus de l’étape 1; spécialité et informations de profil retenues; demande de rattachement à un établissement partenaire; statut d’attente clairement présenté. Les justificatifs personnels/professionnels ne sont pas téléversés à E‑Carnet; leur vérification est interne entre médecin et établissement.

L’onboarding doit être reprenable. Aucun accès clinique n’est ouvert par la complétion d’un profil.

## 3. Établissement privé et rattachements

1. L’établissement contacte E‑Carnet par e-mail officiel et envoie les preuves de la structure; aucune demande/upload public d’établissement n’est proposé sur la landing page.
2. L’équipe E‑Carnet vérifie manuellement la structure. Un administrateur E‑Carnet authentifié et autorisé valide/refuse dans une route interne. Après validation, le backend crée l’entité établissement et l’accès du responsable nominatif.
3. Une invitation unique valable **48 heures** est envoyée au responsable; il définit lui-même son mot de passe. Aucun mot de passe temporaire n’est envoyé par e-mail. Une structure demeure indépendante de son administrateur; celui-ci peut être remplacé sans recréer l’établissement. Un seul administrateur actif est prévu en V1; plusieurs pourront être envisagés plus tard.
4. L’administrateur établissement contrôle la vérification interne du médecin, génère un code aléatoire à usage unique valable **48 heures**, et le communique au médecin. E‑Carnet ne collecte pas les pièces personnelles du médecin.
5. Le médecin déjà titulaire d’un compte Professionnel saisit le code; cela le consomme et crée seulement une demande de rattachement `pending`. L’administrateur établissement accepte ou refuse. Seule l’acceptation active le rattachement; un code ne confère jamais d’accès automatique.
6. L’administrateur actif consulte les dossiers ayant une pré-consultation clôturée ou une consultation dans son établissement. Le professionnel accède uniquement au cas qui lui est attribué, avec un rattachement actif, un établissement actif et une autorisation patient active. Aucun accès automatique aux données d’un autre établissement.

Le détail, les contrôles d’accès, la conservation et le plan de réalisation sont dans le [flow établissement](FLOW-ETABLISSEMENT.md) et l’[ADR-002](adr/ADR-002-etablissement-invitation-et-rattachement.md).

**État technique observé au 05/10/2026 :** la route publique historique est neutralisée (`403`). Les routes staff, la relation `EstablishmentAdministrator`, l’invitation hashée à usage unique/48 h, les codes médecin hashés à usage unique/48 h, la demande `pending`, la décision de l’administrateur établissement et l’isolation entre structures sont présents et couverts par des tests ciblés. Il reste à configurer et vérifier SMTP en staging, durcir la console pour la production et recetter sur PostgreSQL/staging.

## 4. AccessGrant, QR et scopes

Le QR initie une demande sans contenir de données médicales; jeton opaque, non devinable, usage contrôlé et expiration. Le dépôt offre une API patient d’émission de jeton haché à usage unique, validité produit de **5 minutes**, consommé par l’API professionnelle. L’interface de génération/affichage/scan est livrée ; les 5 minutes sont la durée produit retenue pour la V1.

Les scopes doivent être visibles au patient et strictement appliqués. **Décision A9 :** `preconsultation` + `declarations` par défaut, `consultations` sélectionnable, `documents` hors V1. Cette décision est appliquée dans le code ; la recette UX mobile/staging reste à faire.

Invariants : aucun accès avant consentement; contexte professionnel, vérification/rattachement et établissement actifs; durée serveur actuellement 2 h, deux prolongations d’1 h et révocation immédiate (à recetter en environnement cible).

## 5. Design et rôle des prototypes

L’expérience doit être mobile-first. Reprendre l’ambiance et la structure générale des maquettes : navigation compacte, cartes denses et lisibles, hiérarchie claire, palette, proportions, états, icônes cohérentes et zones tactiles. Décliner proprement les grands écrans sans prétendre recopier pixel pour pixel.

**À garder à jour :** les flow produit viennent de cette roadmap; les prototypes apportent seulement la direction visuelle. L’état live a le nom et les textes d’authentification français, mais la navigation utilise encore plusieurs glyphes Unicode à remplacer par des icônes cohérentes; l’alignement de la composition mobile n’est pas terminé.

## 6. État réel de la V1 dans l’archive

| Domaine | État constaté |
|---|---|
| Socle Next.js/Django, sessions, CSRF, données fictives | Présent; contrôles locaux rejoués passants. |
| Argon2id | Configuré comme premier hasher Django; à recetter en déploiement. |
| OAuth Google/Facebook/Apple | Endpoints et modèle identité présents; secrets/configuration, retours UI, liaison visible, audit/tests à compléter. |
| Onboarding | Inscription e-mail auto-contexte Patient; choix Patient/Professionnel ensuite. Étape identité/avatar et formulaires conditionnels présents ; recette métier restante. |
| Professionnel / justificatifs | Profil sommaire; flow d’affiliation incomplet. Les pièces du médecin restent internes à l’établissement et ne sont pas collectées par E‑Carnet. |
| Startup / administrateur établissement | Flow API/UI présent : route publique neutralisée, console staff, compte nominatif, invitation 48 h et rattachement par code ; e-mail réel et recette production à faire. |
| QR | Backend partiel; expérience écran/scan manquante. |
| AccessGrant scopes | Contrat A9 appliqué : pré-consultation + déclarations par défaut, consultations sélectionnable, documents hors V1. |
| SVG | Hash/horodatage et blocage de quelques vecteurs; sanitizer complet non démontré. |
| MFA/TOTP | Endpoints et stockage des secrets retirés de V1; réimplémentation réservée à V3 avec stockage chiffré et limitation des essais. |
| Design | Maquettes reprises partiellement; icônes/navigation mobile à réaligner. |
| Recette de déploiement | Staging, PostgreSQL réel, restauration/RPO-RTO et vrai mobile/4G non démontrés. |

Vérification locale du 05/10/2026 : 57 tests Django OK et 1 ignoré, `check`, contrôle des migrations, lint et build passés; 27 routes produites. `npm ci` affiche cinq vulnérabilités `high` dans l’arbre d’outillage. Voir [audit détaillé](RAPPORT-AUDIT-ECARNET.md) et [recette](RECETTE-V1.md).

## 7. Ordre de travail restant avant V1

1. Recetter A9 déjà décidé : scopes V1 et QR 5 minutes, sur mobile/staging.
2. Compléter la sanitation SVG avec tests hostiles.
3. Modéliser l’établissement séparément de son admin; bâtir console staff, compte nominatif et invitation à usage unique (48 h).
4. Implémenter codes médecins hashés à usage unique (48 h), demande en attente puis approbation par l’établissement; ne pas demander de justificatifs médecin à E‑Carnet.
5. Réviser le garde clinique pour que l’affiliation active approuvée par l’établissement atteste le rattachement dans cette structure, tout en gardant le consentement patient.
6. Finir OAuth utilisable (callback UI, liaison/déliaison explicite, audit, tests fournisseurs); ne pas déclarer un fournisseur actif sans secrets/URLs réels.
7. Ajouter UI QR patient et scan/entrée côté professionnel.
8. Retirer TOTP des écrans/prérequis V1 et mettre le contenu en V3; SMS reste V3.
9. Aligner le shell mobile et fermer recettes staging/PostgreSQL/mobile/restauration/dépendances avant pilote.

## 8. Versions ultérieures

- **V2 :** consolidation après recette/pilote; récupération de compte, corrections et fonctions documentaires/notifications restent à cadrer.
- **V3 :** OTP SMS et MFA/TOTP; le partage inter-établissements reste conditionné aux décisions de sécurité, médicales et juridiques.
- **V4–V5 :** accompagnement/interopérabilité restent des pistes, non des engagements, jusqu’aux retours du pilote et à des accords vérifiés.

Pas de données réelles avant hébergement ivoirien, validation juridique/médicale, restauration et Go/No-Go formel.
