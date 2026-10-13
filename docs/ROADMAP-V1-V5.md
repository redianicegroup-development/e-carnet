# Roadmap produit — Mon Carnet Numérique, V1 à V5

**Mise à jour : 13/10/2026 — décisions produit actives, périmètre V1–V3 clarifié.**  
**Statut :** V1 en construction, non acceptée et interdite pour les données de santé réelles. Ce document fait foi pour l’intention produit ; l’état réellement implémenté et les preuves sont dans [ETAT-REEL-V1.md](ETAT-REEL-V1.md) et [RECETTE-V1.md](RECETTE-V1.md). Les validations médicales/juridiques et le déploiement restent à obtenir. Les changements de code de cette passe doivent être vérifiés dans la matrice de recette ; leur inscription ici ne vaut pas preuve de staging.

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

### Étape 4 — sécurité et récupération complémentaire

Le compte choisit une question prédéfinie ou saisit sa propre question, puis enregistre une réponse. Le serveur conserve la réponse sous forme hachée et ne la restitue jamais. Cette donnée aide à préparer une récupération future, mais la réponse seule n’autorise ni la récupération du compte ni l’accès au dossier médical. Aucun SMS ni parcours d’assistance n’est activé dans cette étape; une vérification supplémentaire devra être définie avant toute récupération autonome. L’étape ne modifie pas le carnet ni son historique.

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

Le QR initie une demande sans donnée médicale : jeton opaque, usage unique, validité **5 minutes**. Le patient génère le QR temporaire; le professionnel le scanne ou saisit son jeton opaque. **Le QR/jeton suffit à identifier le patient côté serveur : aucun UUID patient distinct ne doit être demandé ni accepté comme exigence UX.** La caméra et le secours par saisie du jeton restent à recetter sur de vrais mobiles.

Les scopes doivent être visibles au patient et strictement appliqués. **A9 est décidé pour la V1** : `preconsultation` + `declarations` par défaut, `consultations` sélectionnable, `documents` hors V1. Le QR est valable 5 minutes et à usage unique.

Invariants : aucun accès avant consentement; contexte professionnel, vérification/rattachement et établissement actifs; durée serveur actuellement 2 h, deux prolongations d’1 h et révocation immédiate (à recetter en environnement cible).

### Carte d’urgence du patient — QR public distinct de l’AccessGrant

Cette carte n’est **pas** un QR d’accès professionnel et ne donne jamais accès au carnet complet. Elle sert à faire connaître un petit ensemble d’informations choisies par le patient en cas d’accident, et à joindre rapidement le contact à prévenir.

- Contenu déclaratif : groupe sanguin, allergies, traitements, nom et numéro du contact à prévenir. Toutes ces informations restent clairement marquées comme déclarées, non vérifiées.
- Le QR contient uniquement un lien opaque, non devinable, signé et révocable — jamais les valeurs médicales en clair. Le scan ouvre une page publique minimale dédiée, sans compte, n’affichant que les champs de la carte et un lien/téléphone **Appeler le contact** (`tel:`). Aucun accès aux autres pages ou données du carnet.
- Le QR reste désactivé tant que le patient ne l’active pas après un consentement explicite décrivant ce qui sera visible. Le patient peut le désactiver ou le renouveler; un renouvellement invalide immédiatement l’ancien QR.
- **Livrable souhaité :** QR exportable en PNG et SVG, plus une carte personnelle soignée, téléchargeable et imprimable en PDF, avec le QR bien contrasté, un titre d’urgence, une date de mise à jour et le moyen d’appeler le contact. Le design est personnalisable (palette/présentation); le prénom sur le support imprimé reste facultatif. Par défaut, ne pas afficher l’identité du patient sur la page publique. Le résultat doit rester lisible sur téléphone comme sur papier.
- La page liée doit être sans cache, sans indexation, avec politique de référent restrictive; pas d’analytics contenant le jeton ou les valeurs de santé. Expliquer qu’une connexion Internet est nécessaire pour ouvrir la page. Si des valeurs sont imprimées en clair sur la carte, elles doivent être un choix distinct, précédé d’un avertissement sur le risque de perte/lecture par un tiers.
- La carte aide à transmettre des informations et à appeler un proche; elle ne diagnostique pas, ne garantit pas une prise en charge et ne remplace pas les secours ou un avis médical. La publication de données réelles dépend des validations médicales, juridiques, sécurité et hébergement.

## 5. Design, personnalisation et UX

L’expérience reste mobile-first, lisible et adaptée au contexte ivoirien et aux connexions 4G. Reprendre l’ambiance générale des maquettes sans recopier leurs flows obsolètes; adapter les grands écrans avec la même hiérarchie et des listes professionnelles plus denses.

### Identité visuelle et personnalisation confirmées

- **Valeur par défaut :** palette **Miel** (identité mixte/neutre) avec titres **Sora** et texte **Bricolage Grotesque**. Miel reste sélectionnable et modifiable.
- Couples typographiques : **1)** titres Sora + texte Bricolage Grotesque (défaut); **2)** titres Mooli + texte Manrope; **3)** titres Fredoka + texte Quicksand, réservée à l’espace patient. Hors patient, l’application emploie une paire sobre et les paramètres ne proposent pas Fredoka/Quicksand.
- Palettes à conserver : **Miel**, **Rose**, **Violet**, **Argile** et **Sauge**. Miel est le défaut. Les thèmes restent librement sélectionnables par toute personne, sans verrouillage selon le genre.
- Ajouter une taille de texte réglable (standard, grande, très grande) pour les personnes malvoyantes, sans empêcher le zoom du navigateur. Contraste, focus visible, zones tactiles et réduction des animations restent requis; faire valider le contraste renforcé en recette avant d’en ajouter un mode distinct.
- Alléger le chargement : ne pas importer/télécharger simultanément toutes les familles depuis Google. Charger la police sélectionnée seulement; privilégier des fichiers locaux WOFF2 en sous-ensemble latin avec licence vérifiée, `font-display: swap` et une pile système de secours. La police par défaut doit être immédiatement disponible sur mobile 4G; les autres choix peuvent être chargés à la demande.

### Parcours UX à préserver

- Pré-consultation : une seule question par écran, progression lisible, grand bouton principal et possibilité de revenir; les champs facultatifs peuvent être passés.
- Chargement et réseau : loader plein écran sans sidebar pendant le contrôle initial; après délai, expliquer « Connexion lente, on réessaie » et proposer une action Réessayer, plutôt qu’un spinner indéfini. Une session expirée ou refusée renvoie à la connexion.
- Navigation mobile : barre compacte flottante inspirée de Movesync, icônes seules mais accessibles; ne pas réintroduire un header séparé.
- Professionnel sur ordinateur : recherche rapide au clavier (raccourci `/`) et listes compactes, sans élargir les droits ni contourner le consentement patient.
- Consentement : afficher dans une carte lisible les ressources demandées, celles qui restent exclues, la durée par défaut (2 h), et des boutons « Autoriser »/« Refuser » de poids égal.
- Journal patient : nom du professionnel et de l’établissement, ressource et quantité consultées, date/heure, durée autorisée et heure d’expiration; ne jamais exposer le contenu médical dans le journal.
- Réseau instable : « Connexion lente, on réessaie » et bouton Réessayer après un délai mesuré; les brouillons médicaux sont sauvegardés côté serveur uniquement, jamais dans un stockage navigateur.
- Recette UX : cinq tests utilisateurs qualitatifs (dont personne âgée, jeune et professionnel pressé), avec observation de la compréhension du consentement et du parcours mobile; pas un substitut à l’audit d’accessibilité.

**Règle de source :** les flows produit et les choix confirmés viennent de cette roadmap; les prototypes n’apportent que la direction visuelle. Les prototypes ne priment pas sur les décisions de sécurité, d’accessibilité ou de confidentialité.

## 6. État réel de la V1 dans l’archive

| Domaine | État constaté |
|---|---|
| Socle Next.js/Django, sessions, CSRF, données fictives | Présent; contrôles locaux rejoués passants. |
| Argon2id | Configuré comme premier hasher Django; à recetter en déploiement. |
| OAuth Google/Facebook/Apple | Endpoints, retour UI, liaison/déliaison et audit présents ; secrets réels et tests fournisseur à faire. |
| Onboarding | Inscription e-mail auto-contexte Patient; choix Patient/Professionnel ensuite. Étape identité/avatar et formulaires conditionnels présents ; recette métier restante. |
| Professionnel / justificatifs | Profil et flow d’affiliation présents ; les pièces du médecin restent internes à l’établissement et ne sont pas collectées par E‑Carnet. |
| Startup / administrateur établissement | Flow API/UI présent : route publique neutralisée, console staff, compte nominatif, invitation 48 h et rattachement par code ; e-mail réel et recette production à faire. |
| QR | Le jeton QR opaque suffit désormais à identifier le patient côté serveur, sans saisie d’UUID distinct; contrat protégé par test API, scan/saisie sur vrais mobiles encore à recetter. |
| Consentement & audit d’accès | Carte patient explicitant périmètre, exclusions et durée, avec actions Autoriser/Refuser de poids égal; journal indiquant professionnel/établissement, ressources et quantités, horodatage et fenêtre d’autorisation, sans contenu clinique. Tests automatisés présents; recette utilisateur restante. |
| Apparence/accessibilité | Miel + Sora/Bricolage par défaut; trois paires et échelle de texte configurables, paire Fredoka/Quicksand réservée à l’espace patient. Préférences persistées par compte et cache local; vérification build et persistance inter-appareils à compléter. |
| Carte d’urgence QR | Exigence produit ajoutée le 13/10 : carte personnalisée téléchargeable/imprimable, QR exportable et lien « appeler ». Une première version de QR/page dédiée a été préparée dans l’archive de travail précédente; l’export carte, le design personnalisable et leur recette restent à terminer. Rien n’est déployé ni autorisé pour de vraies données. |
| AccessGrant scopes | Contrat A9 appliqué : pré-consultation + déclarations par défaut, consultations sélectionnable, documents hors V1. |
| SVG | Allowlist stricte, hash/horodatage et tests adversariaux présents localement ; rendu et pipeline staging à recetter. |
| MFA/TOTP | Endpoints et stockage des secrets retirés de V1; réimplémentation réservée à V3 avec stockage chiffré et limitation des essais. |
| Navigation/design | Sidebar PC pliable et navigation mobile communes aux espaces, Admin inclus; icônes sémantiques cohérentes. Recette responsive/accessibilité restante. |
| Recette de déploiement | 77 tests PostgreSQL 16 et smoke de restauration locale isolée passés le 08/10 ; instance managée/staging, sauvegardes planifiées, RPO/RTO et vrai mobile/4G non démontrés. |

Vérifications consignées le 05/10/2026 : 57 tests Django OK et 1 ignoré sous SQLite, `check`, migrations, lint et build passés (27 routes), smoke Chromium local sur 6 routes. Le 08/10, 77 tests ont réussi sur PostgreSQL 16 local et un smoke de restauration isolée a réussi ; la cible managée/staging et le RPO/RTO opérationnel restent à valider. Les cinq alertes npm `high` mentionnées le 05/10 n’ont pas été revérifiées. Voir [état réel](ETAT-REEL-V1.md), [recette](RECETTE-V1.md) et [rapport d’audit historique](RAPPORT-AUDIT-ECARNET.md).

## 7. Ordre de travail restant avant V1

1. **Recetter les nouveautés V1** : QR seul, carte consentement, journal d’accès intelligible, tailles de texte et sélection de paires; vérifier les tests automatisés puis le parcours en staging.
2. **Carte d’urgence** : tester l’aperçu, l’export PNG/SVG du QR et le PDF imprimable, l’appel du contact, la révocation/rotation et la protection de la page publique sur vrais téléphones et papier.
3. Configurer et recetter SMTP/OAuth sur staging (credentials, callbacks réels).
4. Vérifier permissions staff/établissement et contrôles PostgreSQL (`TRUNCATE`, privilèges runtime) sur la cible.
5. Rejouer les sauvegardes/restaurations managées et mesurer/approuver le RPO/RTO opérationnel.
6. Réaliser la recette mobile/desktop/accessibilité et confirmer déclarations médicales, contraste, zoom, comportement 4G, et chargement des polices; obtenir validations juridiques/hébergement/rétention.
7. Tester qualitativement avec cinq utilisateurs représentatifs; consigner observations sans substituer ce test à la recette médicale/sécurité.
8. Réaliser audit de dépendances daté ; les alertes du 05/10 ne prouvent pas le statut actuel.
9. Garder les prototypes comme références visuelles uniquement ; ne pas réintroduire d’anciens parcours.

## 8. Périmètre fonctionnel par version

Les versions indiquent un ordre de priorité, pas une autorisation de mise en production. Toute donnée réelle reste bloquée par les gates juridiques, médicales, sécurité, hébergement et restauration.

### V1 — carnet fiable, consentement et UX accessible

- Socle déjà défini : identité, patient/professionnel, déclarations avec provenance, préparation de consultation, demandes de consentement/AccessGrant, espace établissement privé et journalisation.
- Carte d’urgence personnelle : groupe sanguin, allergies, traitements, contact à prévenir; activation explicite; QR d’URL exportable; page minimale avec appel en un geste; carte PDF téléchargeable/imprimable et visuellement personnalisable; désactivation et renouvellement.
- Pré-consultation en écrans successifs; navigation mobile compacte; recherche clavier et listes professionnelles denses sur desktop; état de connexion lente avec bouton de reprise.
- Accès professionnel par jeton QR seul; carte de consentement équilibrée et explicite; journal patient décrivant les ressources réellement consultées, le professionnel, l’horodatage et la fenêtre d’autorisation.
- Personnalisation : Miel + Sora/Bricolage par défaut; couples Mooli/Manrope et Fredoka/Quicksand (patient seulement); palettes Rose, Violet, Argile et Sauge en plus de Miel; réglage de taille de texte; seule la paire affichée est chargée par le navigateur.
- Terminer la recette réelle du QR d’accès professionnel, du consentement, de l’accessibilité et des gates d’exploitation avant tout pilote autorisé.

### V1.x — améliorations utiles après les flux de base

- **À spécifier et implémenter :** brouillons de pré-consultation créés/sauvegardés côté serveur uniquement (API authentifiée, lien au patient, sauvegarde progressive et reprise après déconnexion/réseau lent); cadrer durée de conservation et suppression. Ne jamais placer de données de santé en `localStorage`, `sessionStorage` ou IndexedDB.
- Checklist patient de démarrage en trois étapes, non bloquante et réinitialisable.
- Export PDF d’une consultation ou du carnet, après définition du périmètre exporté et avertissement sur le fichier téléchargé.
- Rappel d’expiration des codes d’établissement de 48 h et liste « patients récents » pour le professionnel, sous réserve d’un cadre clair de confidentialité/retention.

### V2 — prévention et suivi quotidien

- Carnet de mesures saisies manuellement d’abord : tension, glycémie, poids, température et pouls; graphiques de tendances et statut clairement « mesuré » ou « déclaré ». Stocker des résumés journaliers plutôt que des flux continus.
- Plan de suivi prescrit (quoi mesurer et à quelle fréquence) pour les parcours retenus avec les professionnels; le partage des mesures exige un consentement séparé et le professionnel ne voit les tendances qu’avec ce consentement. Pas de diagnostic automatique ni de promesse d’alerte médicale.
- Rappels de médicaments, confirmation de prise, renouvellement et stock restant; notifications push avec SMS de secours si un fournisseur fiable est disponible.
- Carnet de vaccination enfant/adulte avec historique et rappel de prochaine dose.
- Rendez-vous, rappels SMS et ticket virtuel avec estimation d’attente si les établissements partenaires fournissent des données fiables.
- Messagerie patient–médecin sécurisée pour le suivi non urgent; contenus éducatifs courts en français (audio possible), revus par un professionnel; rappels de dépistage et informations de couverture santé/CMU.
- Suivi de grossesse, d’enfant et de croissance à cadrer avec des profils de proches et leur consentement.
- Profils pour proches (enfant, parent âgé) et carte d’urgence consultable hors ligne : uniquement après revue juridique, modèle de délégation/consentement, analyse de menace et règles de révocation/expiration hors ligne. Ne pas publier ou mettre en cache des données de santé avant cette validation.

### V3 — services cliniques et intégrations conditionnels

- OTP SMS et MFA/TOTP, avec stockage chiffré, limitation des tentatives et récupération de compte.
- Téléconsultation audio d’abord (réseaux 3G), vidéo facultative via fournisseur WebRTC; accès temporaire limité à la consultation, note versée au carnet, aucun enregistrement par défaut. Identité professionnelle et conformité à valider.
- Téléexpertise entre médecins avec partage de périmètre et consentement patient.
- Ordonnance électronique avec QR à présenter en pharmacie et pharmacies de garde, uniquement si une source fiable et le cadre réglementaire sont confirmés.
- Résultats de laboratoire dans le carnet via partenaires consentis et formats validés.
- Paiement mobile money (Orange Money, MTN, Wave, Moov) via agrégateur autorisé, avec reçu; dépend des contrats, remboursements, sécurité financière et conformité.
- Pas et données de capteurs automatiques uniquement avec une application native/intégration confirmée (Health Connect/Apple Santé ou capteur compatible). Une PWA seule ne lit pas ces sources; Web Bluetooth est limité, et la mesure du pouls par caméra est écartée pour fiabilité insuffisante.
- Assistant de préparation de consultation uniquement : reformuler le récit du patient et suggérer des questions, sans diagnostic ni vérificateur de symptômes. Données synthétiques jusqu’aux validations juridiques, médicales et d’hébergement.
- Toute extension du MFA/OTP, des accès délégués et du partage inter-professionnel est conditionnée à la récupération de compte, à la limitation d’essais et aux audits de sécurité prévus.

### V4–V5 — à décider après retours et partenariats

Interopérabilité élargie, accompagnement avancé et bien-être léger (eau, sommeil, humeur) restent des pistes. Elles ne deviennent pas des engagements avant retours du pilote, preuves d’utilité, partenaires vérifiés et évaluations de risque.

Pas de données réelles avant hébergement ivoirien, validation juridique/médicale, restauration et Go/No-Go formel.
