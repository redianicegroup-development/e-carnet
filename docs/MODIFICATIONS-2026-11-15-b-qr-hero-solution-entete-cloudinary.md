# 15/11/2026 (3e série) — Modal QR responsive, héro, section Solution, en-tête, script Cloudinary → V1_19

Base : V1_18 (héro mobile : boutons côte à côte). Aucune modification du backend.

## 1. « Partager en QR » (PC) — `components/access/access-history.css`
- Avant : tout était serré dans 440 px (pastille « QR temporaire actif » et minuterie coupées sur plusieurs lignes, QR rogné).
- Maintenant : **680 px sur ordinateur** (≥ 720 px), QR à gauche, détails à droite ; **empilé au centre** en dessous. Pastille et minuterie ne passent plus à la ligne. Si l'écran est peu haut (≤ 700 px), le QR passe à 148 px ; au-delà, seule la fenêtre défile (déjà prévu dans `modal.css`). Contrôlé dans Chromium à 1366×768, 1024×600, 1440×900, 800×1000 et 390×844 : la fenêtre tient dans l'écran sur ordinateur.

## 2. Héro
- **Pastille « Carnet de santé numérique » retirée** (`page.tsx`, `landing-content.ts`), PC et mobile.
- **Carrés du titre agrandis** : 1,3 em sur ordinateur (55 → 83 px), 1,5 em sur mobile (30 → 48 px), les trois (les deux diaporamas et le carré de départ de la grande image, mesuré automatiquement). Alignés au milieu du texte.

## 3. Section « Un carnet que vous remettez… »
- L'image main + téléphone est plafonnée à **440 px** et à **64 % de la hauteur de l'écran** : on la voit entière à côté du texte (1440×742 : 336×475 px au lieu d'environ 450×640). Mobile et section « trois étapes » inchangés.

## 4. En-tête public
- À partir de 1200 px : trois colonnes (marque | liens | actions). **Les liens sont centrés sur la page** (centre mesuré identique au centre de l'écran à 1200, 1280, 1440 et 1920 px). Sous 1200 px, le menu burger est inchangé.

## 5. Script Cloudinary — `scripts/upload-cloudinary.cjs`
- **Tri avant envoi** : liste les assets déjà sous `CLOUDINARY_BASE_FOLDER` (API Admin, paginée, images/vidéos/raw), compare aux fichiers locaux (même identifiant public qu'à l'envoi) et **n'envoie que les absents**. `cloudinaryVersions.js` est complété avec les versions lues sur Cloudinary pour les fichiers déjà présents.
- `--dry-run` : montre le tri sans rien envoyer. `--update` : renvoie aussi les fichiers présents dont la taille diffère (image remplacée sous le même nom — sans cette option ils sont seulement signalés). `--force` : ancien comportement (tout renvoyer).
- Si Cloudinary refuse la liste (clés, quota), le script **s'arrête** au lieu de tout renvoyer.
- **À savoir** : le zip `akatech-nextjs-9-updated-files.zip` ne contient pas le script d'envoi d'AKATech Studio (seulement `lib/data.js`, qui appelle `cld()`), j'ai donc fait le tri à partir du script d'e-carnet. Non testé contre le vrai Cloudinary (pas de réseau ici) : tests avec un `fetch` simulé (pagination, authentification, erreur). Premier essai conseillé : `node scripts/upload-cloudinary.cjs --dry-run`.

## Vérifications
- Tests ajoutés : `landing-retouches-2026-11-15.test.mjs` (5), `cloudinary-upload-tri-2026-11-15.test.mjs` (6), `landing-hero-mobile-2026-11-15.test.mjs` (3) : tous verts. Suite web : 474 tests, **12 échecs, exactement les mêmes que sur la V1_17** (aucun nouveau).
- `tsc` et `next build` non lancés (pas de `node_modules`) ; seuls un TSX (`page.tsx`) et un TS (`landing-content.ts`) ont perdu une ligne.
