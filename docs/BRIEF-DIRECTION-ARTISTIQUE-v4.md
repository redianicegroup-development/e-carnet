# Mon Carnet Numérique — brief de direction artistique V4

**10 octobre 2026 — AKATech, module Directeur Artistique (Brand Strategist v3)**
**Cette V4 complète et remplace la V3** (`BRIEF-DIRECTION-ARTISTIQUE-v3.md`, conservée pour l’historique). Tout ce que la V3 proposait est repris.
**Statut (mis à jour le 11 octobre 2026) :** le logo « carnet à bouton » est **retenu provisoirement** par le porteur (« pour le moment, prenons ton logo ») et **appliqué dans l’application** : voir §4.7. Retenu provisoirement ne vaut pas validation : la **Validation 1** du territoire (§2) reste à confirmer avant de figer le logo. La palette, la typographie et le thème par défaut restent `proposés` et **ne sont pas appliqués** : le code reste en Lagon.

Planche visuelle à ouvrir dans un navigateur : [`docs/brand/brand-board.html`](brand/brand-board.html).

---

## 0. Ce que la V4 apporte

| Manque de la V3 | Apport de la V4 | Où |
|-----------------|-----------------|----|
| « Piste de logo » sans dessin | Signe, logotype, 4 variantes, favicon, icône d’app, règles d’usage | §4, `apps/web/public/brand/` |
| Pas de territoires comparés | 3 territoires et un choix argumenté | §2 |
| Palette sans mesure complète | Rôles dérivés et contrastes calculés avec le code | §5 |
| Pas de format exportable | `design-tokens.json` | §10, `docs/brand/` |
| Écart « Sauge `#5B7F68` / `#597C66` » laissé à l’équipe | Écart **expliqué et mesuré** | §5 |
| Identités concurrentes évoquées | **Inventaire exact** dans le code | §4.5 |
| Ton éditorial en une phrase | Tableau « dire / ne pas dire » aligné sur la revue juridique | §8 |
| Livrables listés | État livrable par livrable | §12 |

---

## 1. Direction (inchangée) et cible

Une interface de carnet personnel de santé qui donne une impression de **calme, clarté et contrôle**. Elle ne ressemble ni à un tableau de bord technique, ni à un service qui certifie un médecin ou garantit une prise en charge.

Le patient comprend en quelques secondes : **1.** ce qui vient de lui et ce qui vient d’un professionnel ; **2.** qui demande l’accès ; **3.** ce qu’il autorise et pour combien de temps ; **4.** comment refuser ou arrêter.

**Règle de simplicité :** une idée par écran, des phrases courtes, des boutons explicites, des icônes toujours accompagnées d’un mot.

### Personnalité de marque (3 adjectifs et leurs contraires)

| Elle est | Elle n’est pas |
|----------|----------------|
| **Calme** — pas d’alarme, pas d’urgence simulée | Clinique, froide, hospitalière |
| **Claire** — on lit sans effort sur un petit téléphone | Technique, jargonnante |
| **À la main du patient** — c’est lui qui décide | Protectrice à outrance, « forteresse » |

**Public :** patients de tous niveaux de lecture, souvent sur téléphone et connexion limitée ; professionnels pressés ; administrateurs d’établissement.

---

## 2. Territoires créatifs

Avant de dessiner, trois directions ont été comparées. La V3 en recommandait une seule sans l’opposer à d’autres.

| | **A · Carnet à bouton** | **B · Passage** | **C · Racines** |
|---|---|---|---|
| Idée | Le carnet de santé que l’on connaît, avec un interrupteur : « c’est moi qui décide » | Une porte, une clé, un QR : l’accès temporaire | Une plante, un motif local : la santé naturelle et enracinée |
| Signe | Carnet relié + interrupteur | Modules de QR ou porte entrouverte | Feuille ou motif géométrique inspiré des tissus |
| Palette | Sauge, encre, brume | Encre, vert vif ou bleu nuit | Terre, ocre, vert profond |
| Émotion | Familiarité, maîtrise | Précision, sérieux | Chaleur, appartenance |
| Risque | Le « carnet » peut sembler papetier | **Promesse de sécurité absolue**, froideur, jargon | Cliché « santé verte », emprunt culturel délicat, motifs illisibles en petit |
| Lisibilité à 16 px | ✓ (dos encré + bouton) | ~ | ✗ pour un motif détaillé |
| Cohérence avec le brief V3 | ✓ | ✗ (le cadenas et la sécurité sont écartés) | ~ |
| Différenciation du secteur | ✓ | ~ | ~ |
| Coût de mise en œuvre | Faible : palette Sauge déjà au dépôt | Moyen | Élevé : illustration à produire |

**Recommandation : A.** Elle s’appuie sur un objet que les patients connaissent (le carnet de santé), traduit exactement la promesse « vous décidez » sans promettre une sécurité absolue, tient à 16 px et réutilise la palette déjà présente.

> **Validation 1 requise.** Le territoire doit être validé par le porteur avant que le logo soit figé. Le signe livré est donc `proposé`, pas `figé`.

**Non réalisé :** l’audit visuel de cinq marques nommées (deux locales, deux internationales, une institutionnelle), qui demande des captures et des sources. Les codes du secteur indiqués dans la V3 (croix médicale, stéthoscope, bouclier ou cadenas) sont une hypothèse de travail à confirmer par cet audit.

### Moodboard rédigé du territoire A

- **Matières :** papier de carnet recyclé, toile reliée, fil de reliure.
- **Formes :** rectangles à coins très arrondis (rayons 10, 16, 22 px du code), pilules, un seul élément circulaire par écran.
- **Lumière et photo :** lumière naturelle douce ; mains, carnet, téléphone en gros plan ; personnes en consultation **avec consentement**. Éviter la blouse blanche posée et les photos génériques de banque d’images.
- **Illustration :** aplats, traits arrondis de 1,8 px, jamais de dégradés ni d’ombres lourdes.
- **Mouvement :** l’interrupteur qui glisse (200 ms) est le seul geste signature ; désactivé si l’utilisateur demande moins de mouvement.
- **À composer :** une planche d’images (photos libres de droits ou prises pour le projet) n’a pas pu être assemblée ici ; elle ne doit pas copier de marques existantes.

---

## 3. Le nom

Garder **Mon Carnet Numérique** (nom public) et **E-carnet** (nom court). Dans le logo, le mot est écrit en minuscules (« e-carnet ») ; dans les textes, « E-carnet » avec majuscule.

**Point de vigilance :** « E-carnet » est descriptif et donc peu protégeable comme marque. Une recherche d’antériorité auprès d’un conseil en propriété intellectuelle est à prévoir (l’OAPI, dont la Côte d’Ivoire est membre, centralise l’enregistrement des marques — à confirmer par ce conseil).

---

## 4. Logo

### 4.1 Le signe « Carnet à bouton »

Un carnet relié dont la couverture porte un **interrupteur évidé, bouton à droite**. Il dit : « mon carnet, et c’est moi qui décide ». Il ne montre ni croix médicale, ni stéthoscope, ni cadenas.

| Élément | Rôle |
|---------|------|
| Dos encre | La reliure ; repère immédiat, visible même à 16 px |
| Charnière (jeu de 3 unités) | Sépare dos et couverture : le signe reste lisible en une seule couleur |
| Interrupteur évidé | Le contrôle. Évidé, il prend la couleur du fond, donc fonctionne sur toute surface |
| Bouton à droite | « Ouvert » : l’accès est décidé, pas verrouillé |

**Construction** (grille 72 × 76 unités, tout en tracés vectoriels, script reproductible `docs/brand/source/build_logo.py`) :

- dos : bande x 14–25, coins gauches de rayon 12 ;
- couverture : x 28–86, y 10–86, coins droits de rayon 12, coins gauches de rayon 3 ;
- interrupteur : pilule 40 × 22 évidée ; bouton : cercle de rayon 7.

**Logotype « e-carnet »** : dessiné lettre par lettre au trait (épaisseur constante de 6, extrémités rondes), sans police. Aucune installation, aucune licence de police. Il remplace l’usage d’Unbounded pour le logo envisagé en V3.

### 4.2 Variantes et fichiers (`apps/web/public/brand/`)

| Usage | Fichier |
|-------|---------|
| Principal, fond clair | `logo-horizontal.svg`, `logo-vertical.svg`, `logo-symbol.svg` |
| Fond encre ou photo sombre | `logo-horizontal-on-dark.svg`, `logo-symbol-on-dark.svg` |
| Une couleur encre (tampon, impression N&B) | `logo-horizontal-mono-ink.svg`, `logo-symbol-mono-ink.svg` |
| Une couleur blanche (sur sauge, sur photo) | `logo-horizontal-mono-white.svg`, `logo-symbol-mono-white.svg` |
| Logotype seul | `logo-wordmark.svg` |
| Icône d’application | `app-icon.svg`, `icon-512.png`, `icon-192.png`, `apple-touch-icon.png` |
| Favicon | `favicon.svg`, `favicon-32.png`, `favicon-16.png`, et `public/favicon.ico` (16, 32 et 48 px, chaque taille rendue séparément depuis le SVG) |

L’icône d’application respecte la zone sûre « maskable » (le signe tient dans un cercle de 40 % de la largeur ; mesuré à 187 px pour 205 px autorisés sur 512 px).

### 4.3 Règles d’usage

- **Zone de protection :** 1 « b » autour du signe, b étant le diamètre du bouton (14 unités).
- **Tailles minimales :** signe seul 16 px ; logo horizontal 24 px de haut. En dessous, signe seul.
- **Couleurs autorisées :** celles du tableau §5 uniquement.
- **Interdits :** étirer, incliner, ajouter une ombre ou un contour, recolorer hors palette, poser le logo sauge sur un fond sauge clair, utiliser le signe seul pour remplacer le nom sur la page d’accueil.

### 4.4 Pistes écartées

| Piste | Raison |
|-------|--------|
| Trois anneaux de reliure à gauche | À l’échelle, ils se lisent comme des **traits de vitesse** |
| Perforations de carnet | Disparaissent à 16 px : il reste une tuile générique |
| Perforations + signet | Plus riche, mais le signet se perd en petit et ajoute un second repère à côté de l’interrupteur |
| Cadenas, bouclier, croix | Promesse de sécurité absolue ou codes du secteur écartés par la V3 |

### 4.5 Ce que le code montrait avant l’application du logo : trois identités concurrentes

| Identité | Où |
|----------|----|
| `Icon name="plus"` dans une tuile | `PublicShell.tsx` (en-tête et pied), `SpaceShell.tsx` |
| Caractère « ＋ » | `app/page.tsx` (maquette), `app/v1/page.tsx`, `app/connexion/page.tsx`, `app/staff/layout.tsx`, `WorkspaceNav.tsx` (deux entrées « Consult. »), `EstablishmentWorkspace.tsx` |
| Carnet dessiné à part | `AuthForms.tsx` |

Le signe « + » renvoie à la croix médicale que la V3 veut éviter. Les entrées de navigation « Consult. » utilisent aussi ce caractère comme icône.

### 4.6 Droits

Le logo et la charte sont une création d’AKATech. Prévoir une **cession écrite des droits** vers l’éditeur du service avant publication (voir `LEGAL-DATA-INPUT-ET-COMPLIANCE-v1.md`, question 8).

### 4.7 Application dans le code (11 octobre 2026)

| Élément | Fait |
|---------|------|
| Composant `components/ui/BrandMark.tsx` | Remplace les **sept** anciennes marques : `PublicShell` (en-tête et pied), `SpaceShell`, `AuthForms`, `connexion/page`, `staff/layout`, `v1/page` |
| Composant `components/ui/BrandLogo.tsx` | Logo horizontal complet (signe + « e-carnet »), utilisé sur la page Crédits |
| `layout.tsx` | `icons` : `/favicon.ico`, `favicon.svg`, PNG 32 et 16, `apple-touch-icon.png` (180 px) |
| `public/manifest.webmanifest` | Icônes 192 et 512 px (`any` et `maskable`) et `favicon.svg` ; le manifest n’en déclarait aucune |
| `public/favicon.ico` et `public/brand/` | 17 fichiers : SVG des variantes, PNG et ICO |
| `app/site-pages.css` | Taille et alignement du signe dans les en-têtes (le CSS d’origine `.brand-mark` n’est pas modifié) |

**Non appliqué :** `app/page.tsx` (maquette de l’accueil, qui garde son « ＋ ») ; `theme_color` et `background_color` du manifest et `themeColor` du layout (restent en Lagon) ; les icônes de navigation (voir §7).

**Couleurs du signe dans l’application :** couleurs de marque **fixes** (sauge `#597C66`, encre `#2C3A33`), surchargeables avec les variables `--brand-cover` et `--brand-spine`. Sur le thème par défaut Lagon, le signe sauge reste lisible mais n’est pas dans la même famille que les boutons turquoise : c’est un argument pour le passage au thème Sauge (§13, décision 3).

---

## 5. Palette « Sauge & encre »

### 5.1 Couleurs de marque (reprises de la V3)

| Nom | Valeur | Usage | Contraste mesuré |
|-----|--------|-------|------------------|
| Sauge action | `#597C66` | Boutons, logo, liens | blanc dessus **4,67:1** |
| Encre | `#2C3A33` | Texte, dos du carnet | sur brume **10,84:1** |
| Brume | `#F2F5EF` | Fond de l’application | — |
| Sauge pâle | `#D8E2D0` | Surfaces teintées, bordures douces | encre dessus **8,93:1** |
| Sauge clair | `#A9C4A5` | Accent décoratif, fonds sombres | encre dessus **6,32:1** ; **blanc dessus 1,89:1 : interdit** |

### 5.2 Rôles dérivés (calculés avec `resolveTheme()`)

| Rôle | Valeur | Contraste sur la brume | Remarque |
|------|--------|:---:|----------|
| Texte secondaire | `#636E68` | 4,82:1 | 14 px minimum |
| Texte de lien | `#557762` | 4,54:1 | légèrement plus sombre que l’action |
| Bordure de champ | `#848C88` | 3,13:1 | 3:1 requis pour un composant actif |
| Anneau de focus | `#597C66` | 4,24:1 | 3 px, décalé de 2 px (déjà dans le code) |

### 5.3 L’écart `#5B7F68` / `#597C66`, mesuré

La V3 laissait à l’équipe technique le soin d’accorder les tokens et l’affichage. Le calcul tranche :

- `#5B7F68` avec du texte blanc ne donne que **4,49:1**, juste sous le seuil de 4,5:1 ;
- mais `resolveTheme()` assombrit automatiquement l’action pour atteindre le seuil : la valeur **réellement affichée est déjà `#597C66`** (4,67:1) ;
- il ne reste donc qu’une **incohérence de source** : corriger le preset à `#597C66` supprime l’ambiguïté sans changer l’affichage.

Les couleurs de la palette par défaut actuelle (Lagon) donnent une action de `#3D7F87` à 4,58:1 : acceptable, mais plus proche du seuil.

### 5.4 Statuts de provenance (fixes, jamais personnalisés)

| Statut | Texte / fond | Contraste | Pictogramme | Sens |
|--------|--------------|:---:|-------------|------|
| Déclaré | `#8A6100` / `#FFF3D6` | 5,02:1 | personne | Dit par le patient |
| Mesuré | `#1F4E8C` / `#E6EEF8` | 7,10:1 | barres | Relevé par un outil ou un professionnel |
| Vérifié | `#17704A` / `#E4F5EC` | 5,38:1 | coche | Confirmé par un professionnel |
| Contesté | `#A32D2D` / `#FBEAE8` | 6,07:1 | triangle | Désaccord à examiner |
| Expiré | `#4A5550` / `#E8ECE9` | 6,51:1 | horloge | N’est plus valable |

**Règle :** pictogramme + mot + couleur, jamais la couleur seule. Le rouge reste réservé aux erreurs et aux désaccords. « Vérifié » ne signifie jamais que E-Carnet certifie un professionnel.

### 5.5 Deux familles de statuts à ne pas confondre

Les cinq couleurs de provenance du §5.4 servent aujourd’hui à deux usages différents.

| Famille | Question à laquelle elle répond | Libellés réellement affichés par le code |
|---------|----------------------------------|-------------------------------------------|
| **Provenance** (qui a écrit l’information) | « Qui a écrit cela ? » | « Déclaré par le patient » ; « Saisi dans le compte patient » ; « Consultation médicale validée » |
| **État d’un accès** (où en est la demande) | « Où en est cet accès ? » | « En attente de votre décision » ; « Accès actif » ; « Refusée » ; « Expirée » ; « Révoquée » |

Trois constats dans le code (`PatientAccessGrants.tsx`, `PatientPreconsultations.tsx`) :

1. « Mesuré » et « Contesté » **n’existent que dans les couleurs** : aucune donnée ni écran ne les produit. Les maquettes de la planche qui les montrent sont illustratives.
2. Tout accès qui n’est pas actif (en attente, refusé, expiré, révoqué) s’affiche avec le badge **ambre « Déclaré »** : un accès expiré ou révoqué ressemble à une information déclarée, et le patient ne distingue pas ces quatre états.
3. Une pré-consultation clôturée reçoit le badge bleu « Mesuré » alors qu’elle n’a rien de mesuré.

**Proposition :** deux jeux de badges distincts. Provenance : ambre (déclaré), vert (validé), bleu réservé à une vraie mesure. Accès : vert (actif), ambre (en attente), **gris neutre avec une icône différente** pour refusée, expirée et révoquée. Le rouge reste réservé aux erreurs et aux désaccords : refuser une demande n’est pas une erreur.

**Mode sombre :** non prévu en V1 (le code exige un fond clair). À concevoir séparément, surfaces comprises.

---

## 6. Typographie

| Rôle | Police | Graisses à charger |
|------|--------|--------------------|
| Texte courant, formulaires, titres d’écran | **Plus Jakarta Sans** | 400, 500, 600, 700, 800 |
| Grands titres et chiffres clés seulement | **Unbounded** | 600, 800 |
| Étiquettes courtes, identifiants | **JetBrains Mono** | 500 |

**Problème constaté dans `layout.tsx` :** Plus Jakarta Sans (comme Nunito, Lexend, Manrope et la plupart des polices au choix) est chargée avec `weight: "400"` seulement, alors que le CSS demande 600, 700 et 800 pour les titres, étiquettes et boutons. Le navigateur fabrique alors un faux gras, d’où un rendu irrégulier. Charger les graisses réellement utilisées (ou la version variable).

**Échelle (déjà dans `globals.css`, conservée) :** titre 1 `clamp(1.3rem, 4.8vw, 2rem)` / 800 ; titre 2 `1.05rem` / 800 ; titre 3 `1rem` / 700 ; texte `1rem` / 400 ; introduction `1.05rem` ; étiquette `0.8125rem` / 700 ; chiffre clé `1.9rem` / 800.
**Règles :** corps 16 px minimum, texte secondaire 14 px minimum, pas de capitales sur du texte long, zones tactiles 44 px. La taille de 12 px (`--fs-xs`) est réservée aux badges et étiquettes courtes.

**Unbounded** : très large, elle fatigue en texte long. Elle reste aujourd’hui la police **par défaut du code** : la passer à Plus Jakarta Sans fait partie des décisions à valider (§13).

---

## 7. Icônes, images et infographies

- **Icônes :** un seul jeu, trait de 1,8 px, extrémités arrondies, grille de 16 px, toujours accompagnées d’un mot. Remplacer les caractères Unicode utilisés comme icônes : la navigation de `WorkspaceNav.tsx` utilise quinze glyphes (`⌂ ▤ ＋ ↗ ● ⌕ ▣ ?`) alors que l’application possède déjà un jeu d’icônes (`components/ui/Icon.tsx`, grille 24, trait 1,8). La rubrique « En savoir plus » des paramètres l’utilise désormais.
- **Images :** photos de personnes en situation réelle, avec consentement. Aucune photo de patient fictif présentée comme réelle.
- **Schémas :** montrer le **parcours de la personne**, pas l’architecture serveur (voir le schéma §7 de la planche). Chaque schéma se comprend sans couleur : formes et libellés.
- **Chiffres :** une carte avec un grand nombre, un titre, une explication courte. Pas de 3D, pas de légende éloignée.

---

## 8. Ton rédactionnel

Français simple, direct, humain. Les formulations ci-dessous respectent les réserves de la revue juridique (`DOSSIER-REVUE-JURIDIQUE-v3.md` §6).

| Situation | À dire | À éviter, et pourquoi |
|-----------|--------|-----------------------|
| Autorisation | « Autoriser pour 2 h » | « Accès sécurisé garanti » : promesse |
| QR code | « Le QR code lance une demande » | « En un scan » : laisse croire que le scan ouvre le dossier |
| Révocation | « Vous pouvez révoquer l’accès depuis votre espace » | « À tout moment » : promesse non démontrée |
| Médecin | « Rattaché à Clinique Exemple, confirmé par l’établissement » | « Médecin vérifié » : E-Carnet ne certifie pas |
| Journal | « Les actions sensibles sont enregistrées » | « Chaque lecture est enregistrée » : non démontré |
| Version | « Version de test : données fictives » | « V1 stable », « socle sécurisé » |
| Jargon | « Qui a écrit cette information ? » | « scope », « AccessGrant », « token » |

**Boutons :** un verbe d’action et le résultat (« Autoriser pour 2 h », « Refuser », « Révoquer l’accès »). **Erreurs :** dire ce qui s’est passé et quoi faire, sans reproche.

---

## 9. Écrans et composants

### Priorités (reprises de la V3)

1. **Patient sur téléphone :** accueil et demande en attente ; déclaré par moi / écrit par un professionnel ; écran d’autorisation (professionnel, établissement, contenu, durée) ; boutons Autoriser, Refuser, Révoquer faciles à distinguer ; historique des accès.
2. **Professionnel :** demande et périmètre ; étapes du QR sans laisser croire qu’un scan ouvre le dossier ; saisie de consultation avec origine visible ; message clair si le rattachement ou l’établissement n’est pas actif.
3. **Établissement et équipe interne :** demandes de rattachement, actions Accepter/Refuser expliquées ; accès administrateur limité aux dossiers associés à sa structure, professionnel limité à son cas attribué, sans accès automatique aux données d’une autre structure.

### Principes de mise en page (repris de la V3)

Téléphone d’abord ; navigation mobile à cinq entrées maximum, icône et mot visibles ; cartes simples et séparations visibles ; boutons de **44 px** minimum ; mêmes repères pour formulaires, cartes, badges, erreurs et confirmations dans tous les espaces ; prévoir pour chaque parcours un état vide, un chargement, une erreur, une demande refusée et une session expirée.

### Maquettes déjà livrées dans la planche

Autorisation patient (écran 1) et vue professionnelle avec provenance (écran 2). **Restent à produire :** historique des accès, composants isolés (champ, navigation desktop), prototype testable.

---

## 10. Design tokens et mise en œuvre

Valeurs exportées dans [`docs/brand/design-tokens.json`](brand/design-tokens.json) : couleurs de marque, valeurs résolues (`--bg`, `--primary`, …), statuts, contrastes mesurés, typographie, espacements (base 4 px), rayons, ombres, mouvements, règles d’icônes.

### À modifier une fois la direction validée (non appliqué)

| Fichier | Changement |
|---------|------------|
| `packages/ui/src/themes.ts` | Preset Sauge : action `#597C66` ; `DEFAULT_THEME` → Sauge + Plus Jakarta Sans |
| `apps/api/apps/identity/theme.py` | Même défaut côté API |
| `apps/web/tests/theme.test.mjs`, `apps/api/apps/identity/test_theme_default.py` | Ces tests **imposent aujourd’hui Lagon + Unbounded** : les mettre à jour volontairement |
| `packages/ui/src/styles/tokens.css` | Valeurs initiales Sauge (évite un flash de couleur) ; ombres basées sur l’encre |
| `apps/web/src/app/layout.tsx` | Graisses de Plus Jakarta Sans ; `themeColor: "#F2F5EF"` (les `icons` sont faites : §4.7) |
| `apps/web/public/manifest.webmanifest` | `theme_color` et `background_color` en `#F2F5EF` (les icônes sont faites : §4.7) |
| `app/page.tsx` | Remplacer le « ＋ » de la maquette (les six autres emplacements sont faits : voir §4.7) |
| `WorkspaceNav.tsx`, `EstablishmentWorkspace.tsx` | Remplacer les glyphes Unicode par des icônes du jeu `Icon` |
| `PatientAccessGrants.tsx`, `PatientPreconsultations.tsx` | Deux familles de badges (§5.5) |

**Extraits à reprendre**

```ts
// layout.tsx — metadata
icons: {
  icon: [{ url: "/brand/favicon.svg", type: "image/svg+xml" }, { url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" }],
  apple: "/brand/apple-touch-icon.png",
},
```

```json
// manifest.webmanifest
"theme_color": "#F2F5EF", "background_color": "#F2F5EF",
"icons": [
  { "src": "/brand/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
  { "src": "/brand/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
]
```

```tsx
// BrandMark.tsx — SVG en ligne, aucune requête réseau
export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <svg viewBox="14 10 72 76" width={size} height={Math.round((size * 76) / 72)} aria-hidden="true" focusable="false">
      <path d="M25 10.04 A12 12 0 0 0 14 22 V74 A12 12 0 0 0 25 85.96 Z" fill="var(--text)" />
      <path fillRule="evenodd" fill="var(--primary)" d="M31 10 H74 A12 12 0 0 1 86 22 V74 A12 12 0 0 1 74 86 H31 A3 3 0 0 1 28 83 V13 A3 3 0 0 1 31 10 Z M48 37 H66 A11 11 0 0 1 66 59 H48 A11 11 0 0 1 48 37 Z" />
      <circle cx="66" cy="48" r="7" fill="var(--primary)" />
    </svg>
  );
}
```

> Le `BrandMark` utilise les variables du thème : avec une palette personnalisée, le logo suivrait la palette. Décider si la marque doit rester **toujours Sauge** (alors utiliser les couleurs fixes des fichiers SVG).

---

## 11. Accessibilité et contrôle qualité

- **Mesuré ici :** tous les contrastes des §5.1, §5.2 et §5.4 (algorithme du code) ; zone sûre de l’icône ; absence de débordement horizontal de la planche à 390 px ; lisibilité du favicon à 16 px.
- **Non mesuré :** états survolé, désactivé, sélectionné ; les neuf palettes personnalisables ; lecteur d’écran ; zoom 200 % ; navigation au clavier sur de vrais écrans ; rendu avec les polices réelles (la planche se charge hors ligne avec des polices de repli).
- **À prévoir :** tests avec des utilisateurs qui lisent peu ou utilisent surtout un téléphone.
- Animations rares, courtes, désactivées si le système demande moins de mouvement (déjà géré dans `tokens.css`).

---

## 12. État des livrables de la V3 (§8)

| # | Livrable demandé | État |
|---|------------------|------|
| 1 | Planche de marque | ✓ `brand-board.html` (logo, variantes, palette, statuts, ton) |
| 2 | Page de typographie | ✓ partielle (§6 et planche §5) ; exemple d’écran mobile : voir les maquettes |
| 3 | Composants de base | ✗ à produire |
| 4 | Trois maquettes | ~ 2 sur 3 (autorisation patient, vue professionnelle) ; **historique des accès à faire** |
| 5 | Deux schémas | ~ parcours d’autorisation ✓ ; **provenance d’une information : légende des statuts seulement** |
| 6 | Prototype mobile et variante desktop | ✗ à produire |
| 7 | Valeurs exportées avec contrastes | ✓ `design-tokens.json` |
| 8 | Note de décisions | ✓ §13 |

---

## 13. Décisions à demander au porteur

1. **Valider le territoire A** « Carnet à bouton » (Validation 1), ou choisir B ou C.
2. Valider le **logotype en minuscules** « e-carnet » et la double écriture du nom.
3. Valider **Sauge & encre** comme apparence par défaut (le code reste Lagon tant qu’il n’est pas modifié).
4. Valider **Plus Jakarta Sans** pour le texte et **Unbounded** limitée aux grands titres.
5. Confirmer que le logo reste **toujours Sauge** (choix appliqué par défaut) ou suit la palette personnalisée.
6. Confirmer si les personnes gardent le choix entre neuf palettes et douze polices, ou si seules les couleurs restent personnalisables.
7. Signer la **cession des droits** sur le logo et la charte, et faire la recherche d’antériorité.
8. Faire tester les maquettes par des utilisateurs qui lisent peu ou utilisent surtout un téléphone.

---

## 14. Limites de ce travail

Pas d’audit concurrentiel nommé, pas de planche d’images, pas de test utilisateur, pas de prototype, pas de fichier Figma. Les fichiers du dépôt n’ont pas été compilés (`next build` impossible ici) ; seule la planche HTML et les SVG ont été rendus et contrôlés dans un navigateur, avec des polices de repli.

## 15. Références du dépôt

`packages/ui/src/themes.ts`, `packages/ui/src/styles/tokens.css`, `apps/web/src/app/layout.tsx`, `apps/web/src/app/globals.css`, `apps/web/src/components/public/PublicShell.tsx`, `apps/web/public/manifest.webmanifest`, `docs/prototypes/` (référence de densité, anciens parcours à ne pas recopier), `DOSSIER-REVUE-JURIDIQUE-v3.md`.
