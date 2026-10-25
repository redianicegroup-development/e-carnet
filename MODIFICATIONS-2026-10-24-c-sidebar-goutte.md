# 24/10/2026 (c) — Barre latérale gooey, onboarding du professionnel en trois parties, visite guidée

Trois sujets dans ce zip : (1) la cloche et le menu du compte de la barre latérale ; (2) l'onboarding du professionnel ; (3) 8 fichiers du 20/10 qui manquaient à votre v2.9.

## 1. Cloche et menu du compte de la barre latérale : la même goutte gooey que l'en-tête

Base : votre `e-carnet_v2.9.zip` (et non mon dernier zip : votre version contient déjà vos corrections de lint et un premier menu gooey dans la barre latérale).

## Ce qui n'allait pas (constaté en rendant la barre latérale de la v2.9 dans Chromium)
- `soft-skin.css` contient `@media (min-width: 920px) { body .gm { display: none; } }` : toute cloche construite sur `.gm` est cachée sur PC. Sur votre capture, ce qu'on voit est donc un mélange de règles.
- `notification-bell.css` gardait d'anciennes règles (`notification-bell__goo/__anchor/__blob`, `--nb-w`, `--nb-h`) qui se superposaient aux règles `gm__*` : le texte du panneau s'affichait à un endroit, la goutte à un autre, sans fond.
- Le menu du compte de la barre latérale débordait aussi : contenu décalé par rapport à la goutte, et en rail replié le panneau était complètement hors place. La goutte de départ dépassait sous la ligne du compte, même fermée.

## Ce qui est fait
- **Une seule mécanique** pour la cloche et le menu du compte de la barre latérale (`shell/sidebar.css`, bloc « Cloche et menu du compte de la barre latérale »), construite sur les classes `gm__*` de l'en-tête (mêmes filtre, ombres, ressort `--spring` de 0,7 s, cascade du contenu qui sort du flou).
- **Barre dépliée** : la goutte part de la ligne, grandit vers le haut. La cloche est une ligne « Notifications » avec sa pastille de non-lues, comme les autres entrées.
- **Rail replié** : la goutte part de la pastille de 40 px et s'ouvre vers la droite, au-delà du rail, alignée sur le bas.
- Le calque filtré n'existe qu'à l'ouverture et pendant la fermeture : plus de goutte qui dépasse quand c'est fermé.
- `NotificationBell.tsx` : libellé « Notifications » (visible seulement dans la barre dépliée), ancrage à gauche du bouton en barre latérale, suppression de l'ancien calcul `--nb-h`.
- `notification-bell.css` : suppression des règles mortes ou parallèles. **L'en-tête mobile n'est pas touché** : rendu comparé avant/après, identique au pixel près (cloche ouverte et menu ouvert).

## Lint (CI)
Vos corrections des 3 erreurs `set-state-in-effect` sont déjà dans la v2.9 (je ne les ai pas touchées). Restent deux avertissements corrigés ici : directive `eslint-disable` inutile dans `PatientCarnet.tsx`, dépendance `render` volontairement exclue dans `InkCapture.tsx` (directive avec justification). Les avertissements `<img>` ne bloquent pas la CI.

## Fichiers
`apps/web/src/components/shell/sidebar.css`, `notifications/NotificationBell.tsx`, `notifications/notification-bell.css`, `InkCapture.tsx`, `PatientCarnet.tsx`, `apps/web/package.json` (+ le test), `tests/sidebar-goutte-2026-10-24.test.mjs` (nouveau), `tests/grille-gooey-2026-10-23.test.mjs` (la goutte de la cloche est désormais testée dans `soft-skin.css`).

## Vérifié / non vérifié
- Vérifié : rendu Chromium de la barre dépliée et du rail, cloche vide/avec 3 notifications, menu du compte ; mesure image par image de la taille de la goutte (disque de 40 px → panneau avec dépassement du ressort → stabilisation ; fermeture symétrique puis disparition) ; tests Node.
- **Non exécuté** : `npm run lint` (le registre npm est injoignable depuis mon environnement) ; la page réelle Next avec vos données. Le rendu est celui d'une page de test qui reprend le même balisage et les mêmes feuilles de style : à confirmer dans le navigateur, y compris avec vos 5 palettes.

---

## 2. Onboarding du professionnel : d'abord patient, puis professionnel, puis l'étape 4

### Parcours demandé
Étapes 1 (identité) et 2 (choix de l'espace) communes. À l'étape 3 :
- **patient** : son carnet (inchangé), puis étape 4 ;
- **professionnel** : il remplit **d'abord son carnet patient** (son espace patient est prêt le jour où il fera « Changer d'espace »), **puis** ses champs professionnels, **puis** l'étape 4 (question de récupération, toujours obligatoire).

### Ce qui change pour un professionnel
| Écran | Étiquette | Suite |
|---|---|---|
| Étape 2 · « Je suis professionnel » | — | `/onboarding/patient?suite=professionnel` |
| Étape 3 · partie 1 sur 3 · **votre carnet patient** | même formulaire que le patient (nom, prénoms, ville obligatoires…) | enregistre le carnet patient, puis active l'espace professionnel → partie 2 |
| Étape 3 · partie 2 sur 3 · **profil professionnel** | spécialité déclarée | `/professionnel/onboarding/ordonnance?etape=3` |
| Étape 3 · partie 3 sur 3 · **cachet et signature** (facultatif, « Passer » possible) | | `/onboarding/securite` |
| Étape 4 · récupération du compte | inchangée | l'espace professionnel |

- Aucun changement côté serveur : l'étape 2 active le contexte *patient* ; l'enregistrement du carnet patient le termine ; on active alors le contexte *professionnel* ; l'enregistrement de la spécialité le termine. À la fin, un seul contexte est actif (le professionnel) et le menu « Changer d'espace » est disponible, avec un espace patient déjà rempli.
- **Reprise** : si le professionnel s'arrête pendant la partie 1, il repart de l'étape 1 (il est encore « patient incomplet ») ; s'il s'arrête après, la connexion le ramène sur son profil professionnel (le carnet patient est déjà fait). Dans ce second cas, l'écran n'affiche pas le libellé « partie 2 sur 3 » (il n'a plus le paramètre `?etape=3`), le contenu est le même.
- Le patient seul ne voit rien de nouveau. La modification du profil depuis les paramètres ou l'accueil n'affiche pas les libellés d'inscription.

### Fichiers
`app/onboarding/page.tsx`, `app/onboarding/patient/page.tsx`, `components/PatientOnboarding.tsx`, `app/professionnel/onboarding/page.tsx`, `components/ProfessionalOnboarding.tsx`, `app/professionnel/onboarding/ordonnance/page.tsx`, `components/ProfessionalCredentialsOnboarding.tsx`, `components/ProfessionalCredentialsSettings.tsx` (prop `eyebrow`), test `tests/onboarding-professionnel-2026-10-24.test.mjs` (nouveau), `tests/espaces-2026-10-22.test.mjs` (une regex mise à jour).

### Vérifié / non vérifié
- Vérifié : syntaxe TypeScript des fichiers modifiés ; tests Node (3 échecs restants, déjà connus : voir le point 3).
- **Non exécuté** : le parcours complet dans un navigateur avec le vrai serveur (l'application Next et Django ne tournent pas dans mon environnement). À dérouler une fois avec un compte neuf : inscription → étapes 1, 2 « professionnel », 3 (3 parties), 4 → « Changer d'espace » → l'espace patient doit être déjà rempli.

---

## 3. Fichiers de mon zip du 20/10 que votre v2.9 n'avait pas : maintenant inclus
Votre v2.9 n'avait pas reçu ces 8 fichiers, qui sont désormais à leur place dans ce zip (chemins normaux, rien à trier) :
`app/error.tsx`, `app/global-error.tsx`, `app/loading.tsx`, `app/not-found.tsx` (pages 404, erreur et chargement sur la marque), `components/AuthForms.tsx`, `components/PatientAccessGrants.tsx`, `components/PatientHomeIdentity.tsx`, `components/RecoverySetup.tsx` (version du 20/10 : la question de récupération permet bien de choisir un nouveau mot de passe).

- Ils remplacent vos versions du 18–19/10 : comparez avec un `git diff` avant de copier si vous aviez modifié l'un d'eux entre-temps.
- Effet constaté : 4 tests de `npm test` qui échouaient déjà dans la v2.9 (QA-01, QA-02, étape 4, UX-04) passent. Il reste 3 échecs connus, qui ne viennent pas de ces changements : le centre d'aide `/faq`, le QR d'urgence dans `AccountSettingsClient`, le cache du thème.
- Contrôle fait : avec ces fichiers, tous les imports relatifs du projet se résolvent (aucun module manquant). **Non fait** : un vrai `tsc` / `next build` (les dépendances npm sont injoignables depuis mon environnement). Je ne peux donc pas affirmer que ces fichiers étaient la cause de vos erreurs de compilation en production : lancez `npm run build --workspace=@ecarnet/web` après copie et envoyez-moi l'erreur exacte si elle persiste.

---

## 4. Visite guidée à la première connexion (comme NexuraTour)
Une visite interactive par espace : un cadre met en lumière un vrai onglet (ou bouton), une carte dit à quoi il sert, puis « Suivant ». Le reste de l'écran est assombri et rien n'est modifié pendant la visite (un écran transparent empêche de cliquer à travers). Tout vient des variables de la palette : aucune couleur propre. La carte naît avec la même goutte gooey que les autres panneaux (si « réduire les animations » est activé, elle apparaît sans mouvement).

### Quels onglets, pour qui, et pourquoi
Une étape = un onglet qui change ce que l'utilisateur fait. On n'explique pas tout : 5 à 7 étapes, faciles à finir.

| Espace | Étapes (dans l'ordre) |
|---|---|
| **Patient** (7) | Bienvenue · **Accueil** (carte d'urgence, prochaines étapes) · **Mon carnet** (allergies, traitements, vaccins, documents) · **Visites** (historique, préparer la prochaine) · **Partage** (QR de 5 min, ce que le professionnel voit, retrait de l'accès) · **Notifications** (la cloche) · **Menu du compte** |
| **Professionnel** (6) | Bienvenue · **Accueil** · **Rattachement** (à faire en premier : code de l'établissement) · **Patients** (accès par QR, tracé) · **Suivi** (consultations, ordonnances) · **Menu du compte** |
| **Établissement** (6) | Bienvenue · **Accueil** (créer le code de 48 h pour un médecin) · **Équipe** · **Demandes** (confirmer ou refuser un rattachement) · **Paramètres** (pré-consultation, modèle d'ordonnance) · **Menu du compte** |

- **Professionnel pas encore rattaché** : les onglets Patients et Suivi sont masqués, donc ces deux étapes sont sautées automatiquement (visite de 4 étapes, la 3ᵉ explique qu'ils apparaîtront après le rattachement). Même règle pour Demandes / Paramètres côté établissement et pour la cloche.
- **Le menu du compte** est toujours la dernière étape : il indique où revoir la visite.

### Quand elle démarre, quand elle reprend
- Elle démarre seule à la première connexion, **une fois le choix des cookies fait** (la bannière passe avant), environ 5 secondes après l'arrivée pour laisser passer le message de bienvenue.
- Elle est mémorisée **par compte et par espace** (un compte qui a les trois espaces voit trois visites, une par espace) dans le navigateur de l'appareil. **Si le cookie / les données du site sont effacés, la mémoire et le choix des cookies disparaissent : la visite reprend à la connexion suivante.** Nouvel appareil ou nouveau navigateur : elle reprend aussi.
- **Pas de nouveau cookie** : le registre des cookies de `lib/legal/config.ts` (testé) est inchangé. La mémoire est une petite entrée `ecarnet.tour.v1.<compte>.<espace>` qui ne contient qu'une date, dans le stockage local, comme la copie du thème. Le code passe par le point d'accès unique `deviceStorage()` de `lib/themeStorage.ts` (un test du projet impose qu'un seul fichier touche au stockage local).
- Sans stockage possible (navigation privée stricte), la visite ne se rejoue pas à chaque page.
- **Revoir à tout moment** : « Revoir la visite guidée » dans le menu du compte (barre latérale PC, en-tête mobile) et une question dans le centre d'aide.
- Clavier : Échap quitte, flèches gauche/droite naviguent, Tab reste dans la carte ; la carte est un dialogue accessible (`role="dialog"`).
- Elle ne s'affiche jamais par-dessus un écran bloquant (changement de mot de passe obligatoire, profil à compléter).
- La page de confidentialité (« Stockage local ») mentionne la mémoire de la visite.

### Fichiers
Nouveaux : `lib/tour.ts` (étapes, mémoire, placement ; sans React), `components/tour/ProductTour.tsx`, `components/tour/tour.css`, test `tests/visite-guidee-2026-10-24.test.mjs` (ajouté au script `test` de `package.json`).
Modifiés : `components/shell/SpaceShell.tsx` (montage + entrée de menu), `components/shell/AppSidebar.tsx`, `components/shell/GooeyAccountMenu.tsx`, `components/notifications/NotificationBell.tsx` (repères `data-tour`), `lib/themeStorage.ts` (`deviceStorage()`), `components/help/helpContent.ts`, `app/confidentialite/page.tsx`.

### Vérifié / non vérifié
- **Vérifié dans Chromium** avec le vrai composant et les vraies feuilles de style des trois espaces, sur PC, rail replié et mobile : délai du premier affichage, 7/6/6 étapes avec les bons titres, cadre et carte bien placés (à droite de la barre latérale, au-dessus de la barre basse, sous l'en-tête mobile), pas de débordement, mémoire enregistrée, pas de rejeu après rechargement, **rejeu après effacement des données du site**, professionnel non rattaché (4 étapes).
- Tests : `npm test` → 191 tests, 3 échecs déjà présents dans votre v2.9 (centre d'aide `/faq`, QR d'urgence dans `AccountSettingsClient`, cache du thème) ; tous les imports se résolvent ; syntaxe TypeScript contrôlée.
- **Non exécuté** : dans l'application Next complète avec le vrai serveur (la mise en page a été contrôlée avec un harnais qui reproduit les espaces) ; ni `npm run lint`, ni `tsc`, ni `next build` (dépendances npm injoignables ici). Lancez `npm run lint` et `npm run build --workspace=@ecarnet/web` après copie.
- Les textes des étapes sont en français courant et prudents (« peut consulter », pas de promesse médicale) : relisez-les, ils sont tous dans `lib/tour.ts`.

---

## 5. Fusion sur la base du 25/10 (e-carnet.zip)
Le zip (c) a été appliqué sur le projet du 25/10, pas écrasé fichier par fichier. Deux fichiers ont été fusionnés à la main pour ne pas faire reculer des textes plus récents :
- `components/help/helpContent.ts` : on garde la question « Quels dossiers l’administrateur d’un établissement peut-il consulter ? » du projet ; on ajoute seulement « Comment revoir la visite guidée ? ».
- `app/confidentialite/page.tsx` : on garde la ligne « Administrateur d’établissement » du projet ; on remplace seulement la puce « Stockage local » (mention de la visite guidée).
Les autres fichiers du zip (c) sont repris tels quels (ils n’ajoutaient que la visite guidée / les repères `data-tour`).
