# Roadmap produit — Mon Carnet Numérique, V1 à V5

**Mise à jour : 08/10/2026 — décisions produit actives.**  
**Statut :** V1 en construction, non acceptée et interdite pour les données de santé réelles. Ce document fait foi pour l’intention produit ; l’état réellement implémenté et les preuves sont dans [ETAT-REEL-V1.md](ETAT-REEL-V1.md) et [RECETTE-V1.md](RECETTE-V1.md). Les validations médicales/juridiques restent à obtenir.

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

Le code contient callbacks OAuth, `AuthIdentity`, contraintes anti-doublon, retour UI et interface de liaison/déliaison avec audit. La livraison réelle reste conditionnée aux credentials, callbacks réels et tests bout en bout des fournisseurs. OTP SMS est **V3**; WhatsApp n’est pas retenu.

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
6. L’établissement ne consulte pas de dossiers médicaux. Le médecin rattaché demande l’accès dans son contexte professionnel; la lecture dépend encore de la structure active, du périmètre AccessGrant et du consentement patient.

Le détail, les contrôles d’accès, la conservation et le plan de réalisation sont dans le [flow établissement](FLOW-ETABLISSEMENT.md) et l’[ADR-002](adr/ADR-002-etablissement-invitation-et-rattachement.md).

**État technique observé au 08/10/2026 :** la route publique historique est neutralisée (`403`). Les routes staff, l’administrateur nominatif historisé, l’invitation à usage unique/48 h envoyée par SMTP configurable, le code médecin hashé à usage unique/48 h, la demande `pending`, l’acceptation/refus, les conditions versionnées et la résiliation par les deux côtés sont présents. L’API ne renvoie jamais le jeton brut. Les tests PostgreSQL 16 locaux couvrent les changements récents ; SMTP/staging, les permissions de production et la recette sur instance managée restent à faire.

## 4. AccessGrant, QR et scopes

Le QR initie une demande sans donnée médicale : jeton opaque, usage unique, validité **5 minutes**. L’API génère le jeton et l’interface patient/professionnel sait générer/scanner ou saisir le jeton. Le formulaire professionnel demande toutefois encore l’UUID patient séparément ; l’expérience complète reste à valider/finir sur mobile.

Les scopes doivent être visibles au patient et strictement appliqués. **A9 est décidé pour la V1** : `preconsultation` + `declarations` par défaut, `consultations` sélectionnable, `documents` hors V1. Le QR est valable 5 minutes et à usage unique.

Invariants : aucun accès avant consentement; contexte professionnel, vérification/rattachement et établissement actifs; durée serveur actuellement 2 h, deux prolongations d’1 h et révocation immédiate (à recetter en environnement cible).

## 5. Design et rôle des prototypes

L’expérience doit être mobile-first. Reprendre l’ambiance et la structure générale des maquettes : navigation compacte, cartes denses et lisibles, hiérarchie claire, palette, proportions, états, icônes cohérentes et zones tactiles. Décliner proprement les grands écrans sans prétendre recopier pixel pour pixel.

**À garder à jour :** les flow produit viennent de cette roadmap; les prototypes apportent seulement la direction visuelle. L’état live a le nom et les textes d’authentification français, mais la navigation utilise encore plusieurs glyphes Unicode à remplacer par des icônes cohérentes; l’alignement de la composition mobile n’est pas terminé.

## 6. État réel de la V1 dans l’archive

| Domaine | État constaté |
|---|---|
| Socle Next.js/Django, sessions, CSRF, données fictives | Présent; contrôles locaux rejoués passants. |
| Argon2id | Configuré comme premier hasher Django; à recetter en déploiement. |
| OAuth Google/Facebook/Apple | Endpoints, retour UI, liaison/déliaison et audit présents ; secrets réels et tests fournisseur à faire. |
| Onboarding | Inscription e-mail auto-contexte Patient; choix Patient/Professionnel ensuite. Étape identité/avatar et formulaires conditionnels présents ; recette métier restante. |
| Professionnel / justificatifs | Profil et flow d’affiliation présents ; les pièces du médecin restent internes à l’établissement et ne sont pas collectées par E‑Carnet. |
| Startup / administrateur établissement | Flow API/UI présent : route publique neutralisée, console staff, compte nominatif, invitation 48 h et rattachement par code ; e-mail réel et recette production à faire. |
| QR | API et écrans de génération/scan présents ; UUID patient encore requis séparément. 5 minutes/A9 appliqués ; recette complète mobile/staging restante. |
| AccessGrant scopes | Contrat A9 appliqué : pré-consultation + déclarations par défaut, consultations sélectionnable, documents hors V1. |
| SVG | Allowlist stricte, hash/horodatage et tests adversariaux présents localement ; rendu et pipeline staging à recetter. |
| MFA/TOTP | Endpoints et stockage des secrets retirés de V1; réimplémentation réservée à V3 avec stockage chiffré et limitation des essais. |
| Design | Maquettes reprises partiellement; icônes/navigation mobile à réaligner. |
| Recette de déploiement | 77 tests PostgreSQL 16 et smoke de restauration locale isolée passés le 08/10 ; instance managée/staging, sauvegardes planifiées, RPO/RTO et vrai mobile/4G non démontrés. |

Vérifications consignées le 05/10/2026 : 57 tests Django OK et 1 ignoré sous SQLite, `check`, migrations, lint et build passés (27 routes), smoke Chromium local sur 6 routes. Le 08/10, 77 tests ont réussi sur PostgreSQL 16 local et un smoke de restauration isolée a réussi ; la cible managée/staging et le RPO/RTO opérationnel restent à valider. Les cinq alertes npm `high` mentionnées le 05/10 n’ont pas été revérifiées. Voir [état réel](ETAT-REEL-V1.md), [recette](RECETTE-V1.md) et [rapport d’audit historique](RAPPORT-AUDIT-ECARNET.md).

## 7. Ordre de travail restant avant V1

1. Recetter A9/QR sur vrais appareils ; décider si l’UUID patient doit être intégré au QR ou saisi séparément.
2. Configurer et recetter SMTP/OAuth sur staging (credentials, callbacks, délivrabilité).
3. Vérifier permissions staff/établissement et contrôles PostgreSQL (`TRUNCATE`, privilèges runtime) sur la cible.
4. Rejouer les sauvegardes/restaurations managées et mesurer/approuver le RPO/RTO opérationnel.
5. Finaliser recette mobile/desktop/accessibilité, champs médicaux A8/A10 et validations juridiques/hébergement/rétention.
6. Réaliser audit de dépendances daté ; les alertes du 05/10 ne prouvent pas le statut actuel.
7. Garder les prototypes comme références visuelles uniquement ; ne pas réintroduire d’anciens parcours.

## 8. Versions ultérieures

- **V2 :** consolidation après recette/pilote; récupération de compte, corrections et fonctions documentaires/notifications restent à cadrer.
- **V3 :** OTP SMS et MFA/TOTP; le partage inter-établissements reste conditionné aux décisions de sécurité, médicales et juridiques.
- **V4–V5 :** accompagnement/interopérabilité restent des pistes, non des engagements, jusqu’aux retours du pilote et à des accords vérifiés.

Pas de données réelles avant hébergement ivoirien, validation juridique/médicale, restauration et Go/No-Go formel.
