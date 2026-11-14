# Modifications du 14/11/2026 — photos carrées, fonds retirés, lien Redianice (V1.16, fusionnée dans la V1_15 « codes / laboratoire interne »)

**Fusion** : base = la V1_15 « codes d'accès / laboratoire interne ». La landing de la 1.16 y est reportée (cette V1_15 n'avait pas les retouches landing du 14/11 : photo de la section Problème, étapes plein écran sur mobile, fond crème, photos de rôle) .
La note « À savoir » de la carte d'urgence présente dans cette V1_15 reste **retirée** (décision des retouches du 14/11, vérifiée par un test) ; pour la remettre, rétablir le `<p className="lp2-note">` dans `DetailRows.tsx` et retirer l'assertion `doesNotMatch(... /conservée jusqu/)` du test.

## Pied de page et pages publiques
- `REDIANICE_URL = https://redianice.vercel.app/` ajouté dans `lib/credits.ts` (source unique).
- Pied de page : « Redianice » est désormais un vrai lien (nouvel onglet), avec le logo au survol comme AKATech Studio.
- Page Crédits : logo cliquable, nom cliquable dans le texte d'introduction, lien « Visiter le site » sur la carte Redianice.
- Page À propos : nom cliquable dans le texte, logo de l'équipe cliquable.
- Nouveaux composants dans `components/public/RedianiceLogo.tsx` : `RedianiceLogoLink`, `RedianiceLink`.

## Fonds retirés (captures 2, 3 et 4)
- Carte d'urgence, cartes « Proche de confiance » / « Profil enfant » : `.lp2-stage` n'a plus de fond ni de cadre.
- Téléphone de l'étape 3 : la forme jaune `.lp2-blob` est supprimée (CSS et balise).

## Cartes Patients / Professionnels / Établissements
- Photo carrée (1200 × 1200, recadrée depuis les nouvelles images portrait) en fond de carte ; badge, titre, points et bouton par-dessus, sur un dégradé sombre qui part du bas.
- Fichiers remplacés : `public/landing/role-patient.webp`, `role-professional.webp`, `role-establishment.webp`.

## Appel final (« Ouvrez votre carnet… »)
- Nouvelle photo carrée `public/landing/cta-carnet.webp` (1254 × 1254) ; `cta-team.webp` supprimée.
- Mobile / tablette : photo en haut, texte et bouton dessus, fondu vers le vert de la carte.
- Ordinateur (≥ 1100 px) : photo carrée à gauche, texte à droite, fondu horizontal.

## Retouches après la 1.16
- Carte Établissements : photo recadrée plus haut dans l'image d'origine, la dame descend ; la tête n'est plus sous le badge « Établissements ».
- Appel final sur mobile : photo remontée de 10 %, dégradé repoussé sous le téléphone, texte qui démarre à 84 % de la largeur de la carte (unité `cqw`, repli `vw`) : l'écran de l'application est entièrement visible. Ordinateur inchangé.

## Vérifications
- `landing-v2-2026-11-08.test.mjs` : 16 tests verts (un test ajouté). `site.test.mjs` ne se charge pas ici (import `data-policy`), à l'identique de la V1.15 d'origine.
- Rendu contrôlé sur un aperçu statique (1280, 820, 390 px), sans débordement horizontal. `next build`, `tsc` et `eslint` n'ont pas pu être lancés (pas de `node_modules`).
