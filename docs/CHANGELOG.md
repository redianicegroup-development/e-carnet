## 2026-10-18 — Boutons en trois types, gooey, centre d'aide unique, landing en six sections (lot v16 fusionné dans v2)

- **Boutons** : trois types (principal `.button.primary`, secondaire `.button`, discret `.button.ghost`), `danger` = couleur, `small`/`block` = tailles ; connexion, récupération de compte (y compris « Valider ma réponse »), installation, avis flottant, bannière cookies et confirmations passent par `.button`. La confirmation destructive est le bouton principal en rouge.
- **Gooey** : `app/goo.css` + `ui/GooLayer.tsx` — tout bouton, toute modal et toute confirmation apparaît par la goutte (calques décoratifs `aria-hidden`, mouvement réduit respecté).
- **Correctif** : carte « Préparez votre prochaine consultation » (texte blanc sur fond crème) lisible, bouton principal.
- **Aide** : une seule page `/aide` (recherche, filtre par profil, 28 questions) ; `/faq` redirige en 308 ; anciennes ancres `#etablissements` / `#confidentialite` remplacées par `#establishment` / `#donnees`. 11 réponses nouvelles à faire relire.
- **Landing** : six sections, repères chiffrés dans les cartes, trois moments, FAQ de six questions reprises de l'Aide, contact et appel à l'action fusionnés ; section « Évaluations » retirée de la page.
- Fusion sur v2 : formulations de v2 conservées (aucune mention « version pilote » ou « données fictives »), parcours de récupération en deux étapes conservé, tableaux de bord et pages d'information intacts. Voir `MODIFICATIONS-2026-10-18-fusion-v16-dans-v2.md`.
- Tests : `tests/boutons-gooey-aide.test.mjs` (7 tests) ; `landing.test.mjs` et `site.test.mjs` adaptés.

## 2026-10-18 — Pages d'information : UX/UI, schémas SVG animés, Lenis

- **Pages légales** (mentions, confidentialité, CGU) : sommaire collant sur ordinateur et repliable sur mobile, rubrique active mise en valeur, sections numérotées, durée de lecture, barre de progression, bouton « Haut de page », en-tête illustré, résumé à coches. Les liens d'ancre glissent via Lenis (hook `useSmoothScroll`).
- **Schémas SVG animés** dessinés à l'arrivée à l'écran : hébergement, destinataires des données, cookies, rôles et parcours d'accès (CGU), rattachement, carnets papier contre historique continu (À propos), organigramme, signe de la marque et pile technique (Crédits). Textes lus dans `HOSTS`, `COOKIES`, `TECH_VALIDITY`, `CREDITS_*` : aucune information inventée, aucun cadenas devant un destinataire qui reçoit des données.
- **Mouvement réduit / sans JavaScript** : état final toujours affiché ; les états de départ sont posés par GSAP, jamais par le CSS.
- **Conditions de rattachement** : page intégrée au site (en-tête, pied de page).
- Tests : `tests/info-pages.test.mjs` (9 tests).

## 2026-10-18 — Identité du titulaire, constantes, fiche de visite, ordonnance structurée

- **Étape 1 patient = « Identité du titulaire »** (couverture du carnet papier) : nom, prénoms, **ville** obligatoires ; adresse/BP, **profession**, téléphone, naissance et couverture facultatifs ; « Délivré le » affiché automatiquement (date de création du dossier, aucun champ saisi). La ville reste une déclaration du carnet (`city`), pas un doublon. **Pas d'ethnie** : donnée sensible sans utilité clinique. Migration `patients.0009`.
- **Pré-consultation en 4 étapes** : motif, symptômes, **constantes** (poids, taille, température, tension, fréquence cardiaque, SpO₂, glycémie ; tout facultatif, jamais de valeur supposée), personne qui aide. Bornes anti-faute de frappe côté serveur (`care/vitals.py`) et côté web (`lib/vitals.ts`).
- **Consultation du médecin en trois blocs** : motif et symptômes / examen et diagnostic / conduite à tenir. Constantes relues et corrigeables, chacune gardant sa **provenance** (relevée en pré-consultation ou mesurée par le médecin). **Ordonnance en lignes structurées** (médicament, dosage, posologie, durée, instructions) et **examens demandés** (« demandé » ≠ « résultat reçu »), signés avec la consultation, 15 lignes au plus. Migration `care.0009`.
- **Côté patient** : chaque consultation s'affiche comme une page « Visites » du carnet papier (constantes groupées par provenance, diagnostic, ordonnance, examens demandés).
- **Suppression de compte** : la profession et les constantes des brouillons de pré-consultation sont effacées avec le reste.
- Tests : `care/test_consultation_content.py`, `identity/test_identity_titulaire.py`, `tests/consultation-visite.test.mjs`. Voir `MODIFICATIONS-2026-10-18-identite-consultation.md`.

## 2026-10-17 — Pied de page en deux cartes, illustrations de modal animées

- Pied de page public refait sur le modèle fourni : carte de marque en dégradé (logo, accroche, « Restons en contact ! » avec accès contact / aide / sécurité, installation de l’app), carte de liens (titres manuscrits, icône d’app flottante, colonnes Découvrir / Ressources / Informations légales), bloc d’appel à l’action vers la création de carnet, copyright, « Créé par Redianice et AKATech Studio » (logo au survol conservé) et grand filigrane rogné. Adapté de 320 px à grand écran. Police manuscrite Caveat (`--font-script`).
- Illustrations de modal : les 9 humeurs sont animées comme le personnage du login — respiration, tête qui s’incline, clignement des yeux, geste propre à chaque scène (salut de la main, répétition d’haltères, ondes de calme, « ? » flottant, panneaux qui grincent, hochements de tête, ondes sonores, tremblement). « success » réutilise le personnage du login. Mouvement réservé à `prefers-reduced-motion: no-preference`.
- Correction : les tracés copiés des SVG ne reprenaient que le contour ; le second `<path>` (visage : yeux, bouche…) est maintenant inclus. Test `tests/modal-illustrations.test.mjs`. Voir `MODIFICATIONS-2026-10-17-pied-de-page-illustrations.md`.

## 2026-10-16 — « Mon E‑Carnet » : peau de carnet, pré‑consultation clôturée par le médecin, carte virtuelle simplifiée

- **Nom** : le produit s'appelle **Mon E‑Carnet** partout dans l'interface, les e‑mails, le manifeste PWA, les textes légaux et `llms.txt` (identifiants techniques inchangés : `ecarnet:*`, `@ecarnet/ui`, cookies). Le logotype dessiné en tracés (`logo-horizontal.svg`) lit encore « e‑carnet » : à redessiner.
- **Design** : `app/soft-skin.css` : peau **minimaliste et neumorphique** (surfaces de la couleur du fond, reliefs par ombres claire et sombre, champs creusés avec liseré pour garder le contraste), dérivée des variables du thème, donc fidèle aux 5 palettes ; effet **gooey** (filtres SVG `GooeyFilters`) sur la goutte de la barre basse mobile et sur un menu du compte qui se déploie en goutte (`GooeyAccountMenu`, tactile, clavier, Échap). Mouvement réduit respecté.
- **Pré‑consultation** : plus de choix d'établissement ni de clôture par le patient. Un brouillon à la fois (409 sinon), modifiable par le patient ou par l'infirmier avec son téléphone. Le médecin le lit par le QR (dernier brouillon) et **sa signature clôture la pré‑consultation** : établissement posé par le serveur, révision enregistrée, événement `preconsultation.closed`, le tout dans une transaction.
- **Carte d'urgence** : QR unique et statique (plus de renouvellement, la version ne change plus ; couper puis rallumer redonne le même QR), pliable ; carte imprimable retirée ; ville et contact d'urgence deviennent des déclarations du carnet (migration `patients.0008`, avec recopie des valeurs existantes) ; PNG téléchargé avec la photo de profil ou l'avatar à la place du QR ; « Ma carte virtuelle » ne garde qu'un lien « Modifier ma carte ».
- **Déclarations** : la pastille de provenance garde sa forme quelle que soit la longueur du texte.
- **Connexion** : logo cliquable vers l'accueil (plus de bouton « Retour »), lien Crédits et bouton de feedback retirés des pages d'entrée. **Récupérer mon compte** : la réponse à la question secrète permet de choisir un nouveau mot de passe (page en deux étapes `/connexion/recuperation`, `identity/recovery.py`, migration `identity.0017`) ; réponse uniforme pour une adresse inconnue, verrouillage durable progressif, limitation par IP et par adresse, comptes d'équipe exclus, autres sessions fermées, audit et e-mail d'alerte ; l'OTP s'ajoutera comme preuve supplémentaire. Dernier recours : écrire à l'équipe.
- **Réglages** : paires de polices renommées « Sora and Bricolage (par défaut) », « Mooli and Manrope », « Fredoka and Quicksand ».
- **Sécurité / qualité** : `require_scope()` (porte unique des lectures cliniques, avec garde‑fou de test contre les contrôles manuels) ; audit `clinical_data.read` regroupé (un événement par patient et par requête, avec `resource_count`) ; dépendances Python : `requirements.in` + `make lock` + contrôle CI du verrouillage.

## 2026-10-16 — À propos, Crédits, en-tête et pied de page publics

- À propos réécrite : le constat (un carnet papier se perd, et quand il est fini ou rempli on en commence un autre, donc pas de suivi sur la durée), la solution, les publics et l’équipe par rôles. Redianice est mise en avant comme startup porteuse ; le développeur est présenté comme fondateur d’AKATech Studio.
- Crédits : l’ancien récit « Redianice a contacté AKATech Studio » est remplacé (le fondateur d’AKATech fait partie de l’équipe). Équipe par rôles (chef de projet, développement, juridique, deux graphistes), structures, lien vers AKATech Studio. Données dans `lib/credits.ts`.
- En-tête public : menu mobile accessible (bouton, Échap, focus), lien « À propos », section courante soulignée sur la landing, barre de liens à partir de 1200 px.
- Pied de page : colonne « Informations légales » (mentions, confidentialité, conditions d’utilisation, rattachement, cookies) ; bas de page « © 2026 Mon E‑Carnet — Créé par Redianice et AKATech Studio » ; au survol (souris), au doigt posé et au clavier, le logo d’AKATech Studio apparaît (`FooterCredit.tsx`, `public/brand/akatech-studio-logo.webp`). Voir `MODIFICATIONS-2026-10-16-a-propos-credits-pied-de-page.md`.

## 2026-10-15 — landing complète, FAQ enrichie et formulaire de contact

- Landing : le visuel du hero (scène de l’application) démarre petit dans le coin bas-droit, grossit jusqu’au plein écran puis rétrécit en carte, lié au défilement (GSAP ScrollTrigger + Lenis, réversible). Nouvelles sections : repères chiffrés, fonctionnalités, FAQ à rubriques, contact. Voir `MODIFICATIONS-2026-10-15.md`.
- API : `POST /api/v1/identity/contact/` (modèle `ContactMessage`, migration 0016), limitation par IP, champ leurre anti-robot, notification facultative sans donnée personnelle. 16 tests.
- Contact : **case de consentement obligatoire** (politique de confidentialité, lien ouvert à part). Exigée aussi par l'API : sans `consent: true` (booléen JSON strict), réponse 400 et rien n'est enregistré. 2 tests web et 2 tests API ajoutés.
- Web : `lib/contact.ts` et `lib/landing-content.ts` (testables seuls), 2 fichiers de tests ajoutés ; ancres internes gérées par un seul déplacement (plus d’arrivée aléatoire).

## 2026-10-14 — carte d’urgence virtuelle, QR exigé côté serveur, durcissement du QR

- Carte d’urgence virtuelle refaite : carte responsive (nom, prénom, groupe sanguin, ville, allergies, traitements, contact) avec QR à côté ; même carte téléchargeable en PNG ; page publique du scan restylée avec bouton d’appel. Nouveau champ `city` (migration `patients.0007`).
- API : `qr_token` obligatoire pour toute demande professionnelle ; `patient_id` retiré des réponses destinées au professionnel (référence courte à la place).
- QR de consultation : jeton verrouillé et consommé atomiquement, anciens QR invalidés à chaque nouveau, création limitée (30/h), commande de purge `cleanup_access_qr_tokens`. Page publique de carte d’urgence limitée par IP (120/h).
- UI : le QR de consultation n’apparaît plus en haut de toutes les pages ; il vit dans l’onglet « Accès et QR ».
- Régression V1.9 corrigée : des règles de `globals.css` présentes en V1.8 avaient disparu (taille du texte, police des titres, assistant de pré-consultation, listes professionnelles compactes, boutons de consentement) ; elles sont restaurées et protégées par un test.
- Tests, mesurés sur la base 1.9 des correctifs **avant fusion dans la 1.10** : 169 Django (3 ignorés), 46 web ; `npm audit --omit=dev` : 0 vulnérabilité. `next build` à rejouer sur la machine de développement. Chiffres après fusion : voir `MODIFICATIONS-2026-10-15-fusion-correctifs-1.9.md`.

## 2026-10-14 — parcours d'établissement par nom + e‑mail, login PC/mobile, confirmations et cookies (sur la 1.9)

- **Établissement :** l'équipe saisit le nom vérifié et l'e‑mail du responsable ; l'établissement complète sa fiche dans son onboarding (`/etablissement/fiche`), puis enchaîne sur l'étape « sécurité » de la 1.9 si la récupération n'est pas configurée. Suivi des invitations, renvoi, révocation, code interne `ETB-XXXXXX`, refus des doublons. Décision : [ADR-003](adr/ADR-003-fiche-etablissement-completee-par-l-etablissement.md).
- **Sécurité :** un lien d'invitation ne modifie plus un compte existant (le mot de passe pouvait être écrasé) ; un échec SMTP ne fait plus échouer la requête ni créer de doublon ; codes médecin et catalogue réservés aux fiches complètes.
- **Modal de confirmation étendu :** autoriser, refuser ou prolonger un accès, clôturer une pré‑consultation, rattacher ou refuser un médecin, refuser/traiter une demande de compte, créer/renvoyer/révoquer une invitation.
- **Login :** cadre à deux volets sur grand écran, écran d'accueil puis formulaire sur mobile, personnage « answer » animé (clignement, yeux qui suivent le curseur, pouce qui s'agite, salue par le prénom), scène animée GSAP, mouvement réduit respecté. La destination après connexion garde les règles de la 1.9 (transfert de représentation, étape sécurité).
- **Cookies :** cookie animé aux couleurs du thème (plus de SVG noir en `<img>`), boutons de même poids, focus et Échap à la réouverture, lien « Gérer les cookies » en pied de page et réglage dans les paramètres, plus de clignotement au chargement.
- **Tests :** test OAuth mis à jour pour la redirection vers `/onboarding/securite` (+ cas sans récupération) ; 17 tests API et 6 tests web ajoutés. Idées complémentaires : [ROADMAP-V2](ROADMAP-V2.md).

## 2026-10-08 — invitation privée, fin de rattachement, conditions et sauvegarde PostgreSQL

- Retrait définitif du jeton d’invitation brut des réponses API et de la console staff; invitation délivrée par e-mail SMTP configurable.
- Conditions d’accès médecin versionnées; le code médecin n’est pas consommé sans acceptation explicite enregistrée (version, auteur, horodatage).
- Résiliation possible côté établissement et côté médecin; accès futur révoqué, historique, audit et dossiers conservés.
- Décision du porteur : Vercel + Render + Neon pour V1/V2; VPS à réévaluer après V2. Exigences de localisation et rétention encore à valider juridiquement.
- Suite Django vérifiée sur PostgreSQL 16; smoke test sauvegarde/restauration isolée et rapport déposés dans `reports/`.
- Preuves détaillées : [77 tests PostgreSQL](../reports/postgres-tests-20261008.txt), [restauration locale isolée](../reports/postgres-restore-20261008T081823Z.txt) et [matrice CA-01 à CA-24](RECETTE-V1.md). Elles ne constituent pas une recette du staging managé ni une mesure RPO/RTO.


## 2026-10-05 (soir) — Correctifs de revue et refonte UI/UX

> Entrée historique. Les résultats/limites rapportés ici décrivent cette passe du 05/10 ; les preuves PostgreSQL et restauration du 08/10, ainsi que l’état actuel du code, priment.

**Correctifs bloquants relevés à la revue**
- CSRF : le front lisait le cookie avec `slice(9)` (« =jeton »), ce qui faisait refuser par Django toute écriture après connexion (403). Lecture centralisée dans `infrastructure/api/client.ts`, jeton renvoyé aussi en JSON par `/api/v1/csrf/` et gardé en mémoire (fonctionne quand l’API et le web n’ont pas le même domaine). Test navigateur simulé : jeton correct 200, `=jeton` 403.
- Limitation des tentatives : connexion (par IP et par email ciblé), inscription, code médecin, invitation établissement, demandes d’accès, console d’administration Django. Compteurs en table de cache partagée entre workers.
- Configuration : `DJANGO_DEBUG` vaut désormais `false` par défaut ; redirection HTTPS, HSTS (1 jour par défaut), cookies Secure/SameSite=None, confiance au proxy, chemin d’admin configurable (`DJANGO_ADMIN_PATH`).
- Inscription : message d’erreur générique, plus de confirmation qu’une adresse existe déjà.
- Un médecin sans établissement n’avait aucun champ pour saisir son code : ajout de l’écran « Mon rattachement ». Le profil professionnel expose maintenant ses rattachements et la raison d’un verrouillage.
- La feuille de style de l’application était quasi vide (les classes `card`, `button`, `topbar`… n’avaient aucune définition) : réécriture complète.

**UI/UX**
- Shell commun aux trois espaces : en-tête, barre basse à 5 onglets (mobile) / rail latéral (bureau), garde de session. Onglets : patient Accueil · Carnet · Consult. · Accès · Moi ; professionnel Accueil · Patients · Consult. · Accès · Moi ; établissement Accueil · Demandes · Médecins · Aide · Moi.
- Thème par défaut **inchangé** (palette Lagon, police Unbounded) ; la personnalisation palette/police du compte n’a pas bougé. Les styles de l’application sont écrits pour fonctionner avec n’importe quelle palette et police du sélecteur. Jeu d’icônes unique.
- Accueils réels pour les trois espaces (le professionnel n’avait qu’un texte de présentation). Verrou fonctionnel du scan QR tant que vérification, rattachement et établissement actif ne sont pas réunis.
- Nouvelle landing marketing et pages publiques sous un même en-tête/pied de page. Workflow global : `docs/WORKFLOW-GLOBAL.svg`.

**Limites à cette date** : build rejoué dans un bac à sable sans accès aux polices Google (polices stubées pour la compilation) ; aucun navigateur disponible, donc pas de test visuel ni de test E2E authentifié ; PostgreSQL réel, sauvegarde/restauration et staging non rejoués au 05/10. PostgreSQL 16 local et restauration isolée ont depuis été testés le 08/10 ; staging et données réelles restent NO-GO.

## 2026-10-05 — Synchronisation documentation et recette finale

> Résultats historiques de cette passe ; ne pas les confondre avec la preuve PostgreSQL plus récente du 08/10.

- README, cahier de décisions A1–A16, état réel, plan V1, roadmap, matrice de recette, sécurité et déploiement alignés sur le code courant.
- État vérifié : 57 tests API OK, 1 ignoré ; build Next.js avec 27 routes ; smoke Chromium local sur 6 routes.
- A9 documenté comme appliqué : QR opaque à usage unique, 5 minutes ; `preconsultation` + `declarations` par défaut, `consultations` sélectionnable, `documents` hors V1.
- Sanitation SVG documentée comme allowlist stricte avec tests adversariaux.
- Verdict maintenu : NO-GO staging/production tant que PostgreSQL réel, restauration, staging et validations métier/sécurité ne sont pas signés.
# Changelog

## V1 — profils représentés et carte d’urgence hors ligne — 2026-10-13

- Ajout local de profils enfants distincts, de liens parentaux révocables/réactivables et de sélection de dossier avec contrôle d’accès serveur et journalisation. Aucune fusion avec le dossier du parent.
- Ajout du parcours de demande de transfert du même dossier par le titulaire adulte et d’une file de revue dans la console admin; toute approbation exige les attestations staff d’identité et d’âge légal. Le seuil légal reste à configurer après validation juridique; aucune pièce d’identité n’est collectée par l’application.
- Ajout d’un export volontaire de carte d’urgence imprimable avec identité minimale, déclarations sélectionnées, contact, date de mise à jour et mention qu’elle peut être périmée. Les copies hors ligne ne peuvent être effacées à distance.
- Adultes représentés/délégations non activés. Vérifications locales : 33 tests patients/soins OK, migrations et check Django OK, build Next.js OK (42 routes), lint OK avec 4 avertissements `<img>` préexistants. Ces contrôles ne valent pas recette staging.

## V1 — question de récupération complémentaire — 2026-10-13

- Ajout de l’étape 4 de l’onboarding après le profil patient ou professionnel, avec questions prédéfinies et question personnalisée.
- La réponse est hachée côté serveur; l’API n’expose ni la question ni le hachage et un événement d’audit est enregistré sans donnée secrète.
- La question seule ne permet pas de récupérer le compte ni d’ouvrir le dossier médical. SMS et procédure de récupération renforcée restent à concevoir; les données du carnet ne sont pas modifiées.
- Vérifications locales : 12 tests Django identité, migration, build Next.js et lint (0 erreur, 4 avertissements) réussis. La suite web complète a 20 échecs de résolution de chemins Windows et nécessite un correctif.

## V1 — flow établissement confirmé par le porteur — 2026-10-05

> Décision produit historique, amendée le 08/10. Pour l’implémentation et les gates actuels, voir [le flow établissement](FLOW-ETABLISSEMENT.md) et [l’état réel V1](ETAT-REEL-V1.md).

- L’établissement envoie ses preuves par e-mail à E‑Carnet; aucune demande/upload public. Un staff autorisé vérifie puis crée un compte d’administrateur nominatif; un seul admin actif en V1, remplaçable sans recréer la structure.
- Invitation unique à 48 h, mot de passe défini par le responsable; aucun mot de passe temporaire par e-mail.
- Code médecin émis par l’établissement, unique et valable 48 h; il crée seulement une demande `pending`, ensuite approuvée/refusée par l’établissement.
- E‑Carnet ne collecte pas les justificatifs personnels/professionnels médecin; la vérification est interne entre médecin et établissement. L’espace établissement ne lit aucun dossier patient.
- Historique non destructif des comptes, invitations, codes, décisions et rattachements; fin d’accès par suspension/révocation.
- Consigné dans [FLOW-ETABLISSEMENT.md](FLOW-ETABLISSEMENT.md) et [ADR-002](adr/ADR-002-etablissement-invitation-et-rattachement.md); le flow est désormais implémenté côté API/UI ; l’e-mail réel et la recette production restent à faire.

## V1 — audit comparatif et harmonisation des décisions — 2026-10-05

> État et backlog historiques remplacés depuis par la mise à jour du 08/10 ci-dessus.

- Rejeu local des validations sur l’archive : **52 tests Django détectés : 51 réussis et 1 ignoré**, `check`, migrations, lint et build Next.js passés; build avec 26 routes.
- Correction du rapport d’audit ancien : Argon2id est configuré; les callbacks OAuth/`AuthIdentity` existent; un backend QR à jeton haché/usage unique existe; l’attestation SVG a déjà une blacklist partielle, empreinte SHA-256 et horodatage. Ces fonctions restent partielles, pas déclarées complètes.
- Décisions du porteur consignées à cette date : OTP SMS et MFA/TOTP en V3; onboarding identité/avatar puis choix Patient/Professionnel; établissement privé et administrateur nominatif (pas de rôle global « Root »); équipe E‑Carnet vérifie la structure; l’administrateur établissement gère le rattachement.
- Les deux roadmaps ont été harmonisées; les prototypes sont explicitement référence de design mobile, non de flow produit.
- État UI constaté : textes d’authentification français et logo E-carnet; navigation encore fondée sur glyphes Unicode; alignement visuel mobile à terminer.
- À la date de cette entrée, A9, le sanitizer strict, le flow établissement complet et certains parcours UI restaient ouverts ; ces points ont depuis été décidés ou implémentés selon [l’état réel V1](ETAT-REEL-V1.md).
- Aucune modification du code applicatif dans cette mise à jour; changements limités à la documentation.

## V1 — parcours complet et alignement de la recette — 2026-10-04

- Ajout d’un test d’intégration patient → demande AccessGrant → consentement → pré-consultation clôturée → consultation → révocation.
- Sessions serveur et protections d’accès clinique; TOTP/MFA reporté en V3 selon la décision produit actuelle.
- `DJANGO_SECRET_KEY` exigée hors DEBUG; contrôles de tests ciblés.
- Rapport antérieur indiquait 38 tests API à ce moment-là; le dépôt audité le 05/10 contenait 52 tests détectés, avec 51 réussis et 1 test ignoré ; cette formulation est historique et le code a depuis été corrigé. Cette entrée est historique ; voir l’état réel V1 pour le verdict courant.
- À la date de cette entrée : staging, trigger PostgreSQL réel, restauration, Android/4G, OAuth fournisseurs et validations métier restaient à exécuter. Voir la mise à jour du 08/10 pour les preuves PostgreSQL/restauration ultérieures.

## V1 — tranche de sécurisation et préparation de recette — 2026-10-03

- Next.js 16.3.8 et configuration ESLint flat; avis de dépendances à réévaluer.
- Audit append-only, endpoints patient/professionnel, établissement actif, historique et tests d’isolation progressivement ajoutés.
- Seed locale `example.test` opt-in; ne jamais exécuter sur staging partagé/production.
- La suite de tests évoluait pendant les travaux; consulter la recette datée pour l’état courant.

## 0.1.0 — 2026-10-03

- Création du monorepo Next.js/Django, Compose local, CI et préférences de thème par compte.
- Documentation initiale, API et prototypes archivés.

Les entrées historiques consignent l’état à leur date; pour l’état courant, voir [rapport d’audit](RAPPORT-AUDIT-ECARNET.md), [roadmap](ROADMAP-V1-V5.md) et [recette](RECETTE-V1.md).
