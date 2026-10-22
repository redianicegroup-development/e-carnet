# À propos, Crédits, en-tête et pied de page — 16 octobre 2026

Base : `e-carnet_v_12.zip`. Livraison en ZIP différentiel (chemins d'origine conservés).

## Pages
- `app/a-propos/page.tsx` : constat → solution → pour qui → équipe. Aucune promesse écartée par la revue juridique (« à tout moment », « garanti », etc.).
- `app/credits/page.tsx` + `lib/credits.ts` : équipe par rôles (sans noms), structures (Redianice, AKATech Studio avec lien), remerciements, identité visuelle attribuée aux deux graphistes. `CREDITS_UPDATED` = 2026-10-16.

## En-tête (`PublicHeader.tsx`, `site-pages.css`)
- Mobile/tablette (< 1200 px) : bouton menu (`aria-expanded`, `aria-controls`), panneau déroulant, Échap ferme et rend le focus au bouton, appui en dehors ferme, le focus va au premier lien à l'ouverture.
- Lien « À propos » ajouté ; `aria-current` sur la page courante ; sur la landing, la section à l'écran est soulignée (IntersectionObserver).
- Les ancres `/#parcours`, `/#profils`, `/#questions`, `/#contact` sont inchangées.

## Pied de page (`PublicShell.tsx`, `FooterCredit.tsx`, `site-pages.css`)
- 3e colonne « Informations légales » ; le lien « Gérer les cookies » y est déplacé. Le lien « Conditions de rattachement » (`/conditions-rattachement`) y figure : à retirer de la colonne si cette page ne doit pas être publique.
- Bas de page : « © 2026 Mon E‑Carnet », « Créé par Redianice et AKATech Studio », « Retour en haut ». La mention « Version pilote : données fictives » passe sous la phrase de présentation.
- Logo au survol : souris (suit le pointeur), doigt posé (reste ~1,4 s après relâchement, le lien s'ouvre normalement), clavier (au-dessus du lien). Mouvement réduit : apparition sans glissement.
- Image : `public/brand/akatech-studio-logo.webp` (512 × 512, transparente, ~45 Ko), dérivée du fichier fourni.

## Tests
`tests/site.test.mjs` : test des crédits réécrit (ancien récit retiré) + 3 nouveaux (à propos, pied de page, en-tête).
