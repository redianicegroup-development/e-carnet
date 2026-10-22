# Pied de page en deux cartes et illustrations de modal animées — 17 octobre 2026

Base : `e-carnet.zip` (v13, « Mon E‑Carnet »). Le lot du 16 octobre (À propos, Crédits, en-tête) y était déjà fusionné ; seul le pied de page est remplacé. ZIP différentiel : uniquement les fichiers modifiés ou ajoutés par rapport à ton archive, chemins d'origine conservés.

## Fusion avec ta version
Fusion à trois voies (base = mon lot du 16 octobre, ta v13, mon lot du 17). Trois fichiers ont demandé un arbitrage :
- `PublicShell.tsx` : ton seul changement (nom « Mon E‑Carnet », sous-titre du logo, filigrane « MON E‑CARNET ») est rejoué dans le nouveau pied de page. Le sous-titre du logo n'existe plus dans ce pied de page ; l'en-tête garde le tien.
- `site-pages.css` : ton réglage de taille du filigrane (`clamp(2.6rem, 12vw, 10rem)`, interlettrage −.07em) est repris sur la nouvelle règle du filigrane.
- `docs/CHANGELOG.md` : les deux entrées sont conservées, la mienne au-dessus.
`layout.tsx` (police Caveat), `modal.css` et `tests/site.test.mjs` ont fusionné sans conflit. `mon-e-carnet-v13.test.mjs` (aucun « E‑Carnet » sans « Mon » dans `src`) passe.

## Pied de page (`PublicShell.tsx`, `site-pages.css`, `layout.tsx`)
- Deux cartes : marque (dégradé de la couleur principale du thème, texte `--on-primary`) et liens (carte claire). Sous 1000 px elles s'empilent ; sous 560 px les colonnes passent à 2 et « Informations légales » prend toute la largeur.
- Pas de formulaire d'abonnement : il n'existe pas de lettre d'information. Le bloc du modèle devient un appel à l'action « Créer mon carnet » (`/connexion?mode=register`).
- Pas de faux réseaux sociaux : les trois boutons mènent à des pages réelles (contact, aide, sécurité).
- Icône flottante : `public/brand/app-icon.svg`. Titres manuscrits : Caveat via `next/font` (`--font-script`, `preload: false`) ; repli `Segoe Script` / cursive.
- Conservés : colonne légale (dont « Conditions de rattachement » et « Gérer les cookies »), copyright, « Créé par Redianice et AKATech Studio » avec le logo au survol, note de version pilote (sous l'accroche), bouton d'installation.
- Vérifié avec ta nouvelle peau de carnet (`carnet-skin.css`) : aucun conflit visuel, pas de débordement de 320 px à 1440 px.

## Illustrations de modal
- `ModalIllustration.tsx` : SVG en ligne (au lieu d'un masque CSS) découpé en calques, comme `WelcomeCharacter`. Données : `illustrationPaths.ts` (tracés), `illustrationParts.ts` (zones et yeux), `illustrationRigs.tsx` (décors), `illustration.css` (mouvements).
- Les fichiers de `public/illustrations/modal/` restent la source ; le test vérifie que les tracés copiés sont identiques (contour + visage).
- Chaque scène : respiration, tête, clignement, un geste signature. `success` = le personnage du login (même dessin).
- Hors mouvement autorisé : dessin fixe, décors invisibles.

## Tests
`tests/modal-illustrations.test.mjs` (5 tests) + un test de pied de page dans `tests/site.test.mjs`. Suite web complète : 95 sur 96 ; le test de thème qui échoue (`@ecarnet/ui` non lié sans `npm install`) échoue aussi sur ta v13 d'origine. Non exécuté : `next build`, `eslint`, `tsc` (pas de `node_modules`, réseau coupé). Rendu et animations vérifiés dans Chromium avec les vrais composants et le vrai CSS.
