# Fusion du lot v16 (boutons, gooey, aide unique, landing) dans la v2 — 18 octobre 2026

Base : `e-carnet-main.zip` (v2). Lot appliqué : `e-carnet_v16-modifs.zip` (écrit sur la v15). Le détail du lot est dans `MODIFICATIONS-2026-10-17-boutons-gooey-aide-landing.md`.
La v16 n'a pas été copiée par-dessus la v2 : fichier par fichier, seuls les changements propres à la v16 ont été repris. Les fichiers purement v16 (boutons, calques gooey, styles) sont identiques à la v16 ; les autres gardent ce que la v2 a ajouté depuis la v15.

## À faire
1. Décompresser à la racine du dépôt en préservant les chemins, puis **supprimer** `apps/web/src/app/faq/` et `apps/web/src/app/carnet-skin.css` (un ZIP ne supprime pas : l'archive complète les exclut déjà).
2. `cd apps/web && npm test`, `npm run lint`, `npm run build`. Aucune migration, aucun changement d'API.

## Conservé de la v2 (la v16 ne l'a pas écrasé)
- Aucune mention « version pilote » / « données fictives » (les tests de `site.test.mjs` l'interdisent) : hero, pied de page, `llms.txt`, page Sécurité, encadré de l'aide, appel à l'action final et phrase d'avertissement du formulaire gardent le texte de la v2. Le texte v16 « Pas encore… version de test » **n'est pas repris**.
- Récupération de compte en deux étapes (réponse, puis nouveau mot de passe) : seules les classes des boutons changent, y compris « Valider ma réponse », absent de la v16.
- Tableaux de bord (`RoleDashboards`), notifications et « Mise en route » de l'accueil patient, pages d'information (sommaire collant, schémas SVG, Lenis), identité du titulaire, constantes.
- Dans `securite`, `SpaceShell`, `EstablishmentConsole`, `EstablishmentWorkspace`, `credits`, `LegalDocument`, `PublicShell`, `PatientHome` : uniquement les liens vers `/aide` / les ancres et le bouton principal de la carte.

## Ajouté en plus de la v16 (la v2 avait des liens que la v16 ne connaissait pas)
- `connexion/page.tsx` et `connexion/recuperation/page.tsx` : lien « Aide » `/faq` → `/aide`.
- Anciennes ancres `/aide#etablissements` et `/aide#confidentialite` (v2) → `#establishment` et `#donnees`, qui existent dans le nouveau centre d'aide.
- `globals.css` : la règle `.feedback-fab` gardait fond, ombre et rayon propres ; retirés (le bouton est un `.button`). Ce fichier n'était pas dans l'archive v16 et son test (`boutons-gooey-aide.test.mjs`) échouait sans cela.
- `site-pages.css` : la v16 écrivait `var(--nm-raise-sm)`, une variable qui n'existe nulle part (l'ombre des cartes dépannage/glossaire disparaissait). Remplacée par `var(--raise-sm)`.

## À trancher (avant mise en ligne)
- **Contradiction déjà présente dans la v2** : l'aide répond « Oui, utilisez des informations exactes dans votre espace personnel » à « Puis-je saisir mes vraies données de santé ? », la landing répond « Non… N'ajoutez pas de vrais renseignements médicaux ». Les CGU/mentions disent encore que le service n'est pas destiné à des dossiers réels. La v16 impose des réponses identiques mot pour mot ; je n'ai pas choisi à votre place : chaque page garde son texte, et `tests/landing.test.mjs` porte un écart connu (`KNOWN_DIVERGENCES`) à supprimer une fois la réponse unifiée.
- `helpContent.ts`, « Un infirmier possède-t-il un compte ? » : la phrase « Une aide éventuelle se fait dans le compte du patient » est écrite deux fois (résidu de remplacement automatique dans la v2). Non corrigé.
- Les 11 réponses nouvelles de l'aide sont à faire relire par les juristes (liste dans la note v16).

## Vérifié ici
- `npm test` équivalent (Node, sans dépendances) : 125 tests, 123 réussis. Les 2 échecs (carte d'urgence, thème enregistré) existent à l'identique sur la v2 d'origine (114 sur 116 avant fusion).
- `tsc` sur l'arbre avant/après : aucune erreur nouvelle hors modules `react`/`next` absents du bac à sable.
- Les six réponses de la landing sont identiques à l'aide, sauf l'écart ci-dessus.

## Non vérifié
`next build`, `eslint`, `tsc` avec les vrais types, rendu navigateur (boutons, gooey, aide, landing), Django (non touché).
