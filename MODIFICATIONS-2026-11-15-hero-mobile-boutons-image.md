# 15/11/2026 — Héro mobile : boutons côte à côte, image qui ne rétrécit plus à la fin → V1_18

Base : `e-carnet_V1_17.zip`. Aucune modification du backend.

## Ce qui change (mobile, moins de 760 px)
- **Deux boutons sur la même ligne** : « Commencer » à gauche, « Je suis professionnel » à droite, de même largeur (`landing-showcase.css`, `.lp-hero .actions` en grille à 2 colonnes).
- **Image du héro** (`LandingMotion.tsx`) : elle part du carré du titre (« votre / contrôle »), grossit jusqu'au plein cadre au défilement, **puis reste pleine** ; la phase finale qui la rétrécissait en carte est supprimée sur mobile (la durée de défilement reste la même). Elle ne rétrécit qu'en **remontant** vers le héro, en repassant exactement par le même chemin jusqu'à son carré.
- Ordinateur : inchangé (grande carte à la fin, comme avant).

## À savoir
- Sur la capture 4, l'image est dans le coin bas-droit et le titre n'a que 2 carrés : c'est l'état « sans animation » du CSS (mouvement réduit / animation non démarrée). Si cela se produit encore avec l'animation active, noter le téléphone, le navigateur et si « supprimer les animations » est activé.
- Test ajouté : `tests/landing-hero-mobile-2026-11-15.test.mjs` (3 tests verts, les 7 tests du héro du 15/11 restent verts). `tsc` et le rendu réel n'ont pas pu être lancés ici (pas de `node_modules`, pas de réseau) : à vérifier sur un vrai téléphone.
