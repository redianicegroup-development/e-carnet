> **Référence d’état auditée le 05/11/2026.** L’état courant du code, des tests et de l’exploitation est centralisé dans [`docs/ETAT-REEL-PROJET-2026-11-05.md`](docs/ETAT-REEL-PROJET-2026-11-05.md). Les documents datés conservent leur valeur historique ; leurs affirmations ne remplacent pas le code ni cette référence. Une fonctionnalité présente dans le dépôt n’est pas pour autant déployée, validée en staging ou autorisée pour des données réelles.

# Navigation mobile — 03/11/2026

À appliquer **après** `e-carnet_v1_5_fusion-hors-connexion_2026-11-03.zip` (décompresser par-dessus la racine du projet).

## ⚠️ Fichier à supprimer à la main
`apps/web/src/components/public/PublicFooterScrollToTop.tsx` — remplacé par `apps/web/src/components/ScrollToTopOnNavigate.tsx` (un zip ne peut pas supprimer de fichier). `PublicShell.tsx` importe déjà le nouveau composant.

## Ce qui change
1. **5e onglet « Moi » pour le patient** (barre basse mobile ; masqué sur grand écran). `lib/spaces.ts`.
2. **3e onglet de chaque espace en évidence** (patient : Consultations ; professionnel : Suivi) : pastille `--orb-honey`, calculée à partir de la palette choisie (jaune par défaut, elle suit le thème). Mobile uniquement. `AppSidebar.tsx`, `soft-skin.css`.
3. **Pages ouvertes tout en haut** depuis le lien « Aide » (plus d'ancre `#donnees`), la liste « En savoir plus », la barre de navigation et le menu du compte : zones `data-scroll-top="true"`, logique unique `lib/scroll-to-top.ts` + `ScrollToTopOnNavigate.tsx` (aussi utilisée par le pied de page public).

## Tests
`navigation-2026-11-03.test.mjs` (15, ajouté au script `npm test`). Mis à jour : `espaces-2026-10-22` (attentes périmées, échouait déjà), `site`, `legal`. Suite web : 285 tests, 282 réussis ; les 3 échecs restants existaient déjà dans v1.4-final (centre d'aide `/faq`, QR de visite, schémas). Typage et ESLint sans erreur. Non testé sur téléphone réel.

## À trancher
Le 3e onglet du professionnel est aujourd'hui « Suivi » (Accueil, Patients, **Suivi**, Rattachement, Moi), pas « Scanner QR ». Un onglet Scanner exigerait de retirer ou déplacer un onglet.
