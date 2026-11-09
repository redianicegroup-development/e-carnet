# Modifications du 09/11/2026 — landing, 2e et 3e passes : textes puis mode « vitrine » (hero et pied de page inchangés)

Objectif : une vitrine, pas une documentation. Aucun style ni animation n'est touché ; seules la longueur et les textes changent, plus une flèche sur le bouton de l'appel final (comme celle du hero).

## 2e passe — titres
| Avant | Après |
|---|---|
| Ce que votre carnet change, concrètement | Votre santé, enfin réunie au même endroit. |
| Le médecin sait d'où vient chaque information | Chaque information dit d'où elle vient. |
| Vos proches et vos enfants, chacun à leur place | Un carnet par enfant, une fiche d'urgence pour vos proches. |
| Trois étapes, de votre carnet à ses préconisations | Une consultation en trois étapes, sans repartir de zéro. |
| Vous gardez la main sur chaque accès. | C'est vous qui décidez qui lit votre carnet. |
| Avant de vous lancer | (section retirée en 3e passe, voir ci-dessous) |

## 3e passe — vitrine
1. **Bénéfices : 8 tuiles → 4** (Mon carnet, Préconisations, Documents, Rendez-vous et rappels). Retirées : Mesures, Vaccinations (secondaires), Carte d'urgence (déjà détaillée dans sa rangée juste dessous), Historique des accès (déjà dans la démonstration d'accès). Intro : « L'essentiel, d'un coup d'œil. »
2. **Étapes sans chiffres** : « Le QR est temporaire et ne sert qu'une fois. » (plus de 5 minutes ni de 2 heures dans les étapes, ni dans `STEPS`). Les durées restent dans la FAQ, la démonstration d'accès, la page Sécurité et les écrans fictifs du téléphone.
3. **Une seule couche de réassurance avant l'appel final** : la section « doutes » (`ObjectionCards`) est retirée de la page. Il reste la démonstration d'accès (`TrustCopy` + `AccessDemo`), puis la FAQ. Ses quatre doutes sont déjà traités par la FAQ, sauf « je ne suis pas à l'aise avec le numérique » : il passe dans l'appel final (« Commencez par l'essentiel, le reste peut venir plus tard. »).
4. **Solution : intro raccourcie** (deux phrases au lieu de quatre) ; les trois lignes cliquables restent.
5. **Appel final** : « Ouvrez votre carnet avant votre prochain rendez-vous. » ; bouton « Créer mon carnet → » vers `/connexion?mode=register` (même libellé que l'écran de connexion, suivi `data-track="signup"` inchangé).
6. **Hero** : seul `HERO.lead` change (« Réunissez vos informations de santé, remettez votre carnet au médecin et choisissez qui peut le consulter. »). Le reste du hero et le pied de page sont inchangés.

Non touché (à décider) : les trois grandes rangées sous les tuiles (provenance, carte d'urgence, proches et enfants), la FAQ (réponses relues par les juristes) et le CSS devenu inutile de `.lp2-obj*`.

## Fichiers modifiés
`apps/web/src/lib/landing-content.ts`, `src/app/page.tsx`, `src/components/landing/ContactSection.tsx`, `src/components/landing2/{ToolTiles,DetailRows,TrustCopy,SolutionSection,flowParts}.tsx`, `tests/landing-v2-2026-11-08.test.mjs` (ordre et ancres mis à jour ; 2 tests ajoutés).

## À supprimer à la main (un zip de fichiers modifiés ne supprime rien)
```
git rm apps/web/src/components/landing2/ObjectionCards.tsx apps/web/src/components/landing2/WhoCards.tsx apps/web/src/components/landing2/OfflineBand.tsx
```
`WhoCards.tsx` et `OfflineBand.tsx` sont déjà donnés comme supprimés dans la note du 09/11 mais sont encore dans la V1.8 ; `WhoCards.tsx` fait échouer le test « le message est le bon ».

## À faire relire
« C'est vous qui décidez qui lit votre carnet » (et « Aucun accès sans votre choix » dans le hero) ne mentionnent pas l'ouverture d'urgence par un administrateur d'établissement (ETA-09, avec motif et audit).

## Vérifications
Tests `landing`, `etablissement-landing` et `landing-v2` : 33 verts avec les trois fichiers ci-dessus mis de côté. `next build`, `tsc` et `eslint` non lancés (pas de `node_modules`) : à lancer avant déploiement.
