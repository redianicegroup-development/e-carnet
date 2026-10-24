# Mises à jour du 24/10/2026 — gooey unique, tuiles, toast centré, PDF

Aucune migration, aucune nouvelle dépendance. Ce lot est **fusionné** dans `e-carnet-maj-2026-10-24-fusion.zip` avec `e-carnet-maj-2026-10-23.zip` et `-b.zip` : un seul zip à appliquer.

## Gooey : un seul effet, celui du panneau de notifications
Le mécanisme du panneau de notifications devient la référence de toute l'application : une goutte de la couleur du fond grandit d'un petit disque vers sa forme finale avec le **même ressort** (`--spring`, 0,7 s), avec les **mêmes ombres douces**, puis le contenu apparaît en cascade en sortant du flou.
- `app/goo.css` (réécrit) : variables communes `--goo-grow`, `--goo-drop`, `--goo-shadow`.
  - **Boutons** : la pastille grandit depuis un disque au centre (`goo-button-grow`) ; les anciennes gouttelettes sont retirées.
  - **Modales, confirmations, toast** : la goutte naît au bas du panneau, grandit à la taille du panneau et le déborde un instant (`goo-blob-grow`), le panneau net se fond dessous, le contenu sort du flou en cascade (`goo-item-in`).
  - Mouvement réduit : aucun calque, aucune animation.
- `components/notifications/NotificationBell.tsx` : la hauteur du panneau suit désormais son contenu (elle était fixée à 420 px).
- Les fenêtres de **paramètres** gardent leur mise en page ; elles partagent seulement l'animation d'entrée.

## Message de bienvenue centré
`modal/GreetingModal.tsx` + `modal/modal.css` : le toast est dans une scène fixe (`greeting-stage`) qui le **centre sur ordinateur comme sur téléphone** et porte la goutte (`GooLayer`). Toujours non bloquant.

## Sections pliables en grille de tuiles (hors paramètres)
- `components/ui/CollapsibleSection.tsx` + `components/patient-sections.css` : posée dans `<div className="section-grid">`, la rubrique est une **tuile** (2 colonnes sur téléphone, davantage sur ordinateur) avec icône et sous-titre ; ouverte, elle prend toute la largeur.
- **Couleur : aucune couleur propre.** La tuile prend la couleur de la **palette choisie** (`--primary` mélangé à la matière de la page) et change avec elle.
- Utilisée dans : carnet du patient (8 tuiles), consultations du patient, consultations du médecin (historique et vaccinations à confirmer), rattachements du médecin. **Les paramètres ne sont pas touchés.**
- « Mes consultations » est retiré du carnet (il reste dans Visites).

## PDF mis à jour (dans le zip)
`E-Carnet_Cahier-des-charges_version_claire_v11.pdf` (10 pages) et `E-Carnet_Business-plan_version_claire_v11.pdf` (6 pages) : même structure que vos versions, état réel du produit, langage simple. Les chiffres financiers et les chapitres juridiques/hébergement sont **inchangés** (non réexaminés).

## Tests
- Node : `tests/grille-gooey-2026-10-23.test.mjs` (6 tests) ; suite complète **172 réussis sur 175**. Les 3 échecs concernent des fichiers du 17 au 19/10 que je n'ai pas modifiés (dossier `src/app/faq`, `AccountSettingsClient`, paquet `@ecarnet/ui` absent du poste d'essai) : à vérifier dans votre dépôt.
- Tests existants adaptés : `boutons-gooey-aide`, `site`, `ux-flows`, `espaces-2026-10-22`.
- Rendu contrôlé par captures dans un navigateur de bureau (tuiles, toast PC et mobile, confirmation). **Aucun essai sur téléphone réel** ; l'animation n'a pas été jugée en mouvement continu, seulement sur des images fixes.
- Python : rien de nouveau dans ce lot (les tests Python des lots précédents restent à lancer).
